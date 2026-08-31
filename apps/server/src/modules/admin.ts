import { createHash } from 'node:crypto';

import { calculate } from '@niro/engine';
import {
  stableJsonStringify,
  validateCalculatorVersion,
  validateMeasurementDefinitionStructure,
} from '@niro/contracts';
import { Router, type Request, type Response } from 'express';
import { Types, type ClientSession } from 'mongoose';

import { hashPassword } from '../auth/service';
import { requireAdmin, type AuthenticatedRequest } from '../auth/http';
import type { AuthService } from '../auth/service';
import { ADMIN_ROLES, AdminUserModel, type AdminRole } from '../persistence/models/admin-user';
import { AdminSessionModel } from '../persistence/models/admin-session';
import { AdminGovernanceLockModel } from '../persistence/models/admin-governance-lock';
import { AuditLogModel } from '../persistence/models/audit-log';
import { CalculatorModel } from '../persistence/models/calculator';
import { CalculatorVersionModel } from '../persistence/models/calculator-version';
import { MeasurementRevisionModel } from '../persistence/models/measurement-revision';
import { assertVersionMutable, assertVersionTransition } from '../persistence/lifecycle';
import {
  publishVersionAtomically,
  retireVersionAtomically,
  rollbackVersionAtomically,
  withTransaction,
} from '../persistence/transactions';
import type { LifecycleStatus } from '../persistence/types';
import {
  isApprovedMeasurementEnvelope,
  measurementEvidenceExpiryIssue,
  measurementDefinitionIssue as sharedMeasurementDefinitionIssue,
  measurementEnvelopeConsistencyIssue,
  measurementReviewHash,
  nonDerivedMeasurementSemanticEligibilityIssue,
  stableMeasurementEqual,
  stableMeasurementHash,
} from './measurement-contract';
import { invalidatePublicCatalogCache } from './public';

type JsonRecord = Record<string, unknown>;
type TestCase = {
  readonly key: string;
  readonly name: string;
  readonly kind: string;
  readonly inputs: JsonRecord;
  readonly expected: JsonRecord;
};
const TEST_CASE_KINDS = new Set([
  'nonclinical-fixture',
  'source-worked-example',
  'boundary',
  'regression',
]);

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function jsonHash(value: unknown): string {
  return createHash('sha256')
    .update(stableJsonStringify(value as never))
    .digest('hex');
}
function sendFailure(
  response: Response,
  status: number,
  code: string,
  message: string,
  fields?: unknown,
): void {
  response
    .status(status)
    .json({ error: { code, message, ...(fields === undefined ? {} : { fields }) } });
}
function bodyRecord(request: Request): JsonRecord | undefined {
  return isRecord(request.body) ? request.body : undefined;
}
function rejectsUnknownBodyFields(
  request: Request,
  response: Response,
  allowedFields: readonly string[],
): boolean {
  if (request.body === undefined) return false;
  if (!isRecord(request.body)) {
    sendFailure(response, 422, 'INVALID_REQUEST', 'Request body must be an object.');
    return true;
  }
  const unknown = Object.keys(request.body).filter((field) => !allowedFields.includes(field));
  if (unknown.length === 0) return false;
  sendFailure(response, 422, 'INVALID_REQUEST', 'Request body contains unsupported fields.', {
    unknown,
  });
  return true;
}

const MAX_DRAFT_JSON_DEPTH = 40;
const MAX_DRAFT_JSON_NODES = 50_000;
const MAX_DRAFT_ARRAY_ITEMS = 5_000;
const MAX_DRAFT_STRING_LENGTH = 100_000;
const FORBIDDEN_JSON_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

/** Resource/operator safety is separate from schema validity so incomplete drafts remain editable. */
export function draftPayloadSafetyIssue(value: unknown): string | undefined {
  let nodeCount = 0;
  const visit = (item: unknown, depth: number): string | undefined => {
    nodeCount += 1;
    if (nodeCount > MAX_DRAFT_JSON_NODES)
      return `Draft payload exceeds ${MAX_DRAFT_JSON_NODES} JSON nodes.`;
    if (depth > MAX_DRAFT_JSON_DEPTH)
      return `Draft payload exceeds the maximum nesting depth of ${MAX_DRAFT_JSON_DEPTH}.`;
    if (typeof item === 'string' && item.length > MAX_DRAFT_STRING_LENGTH)
      return `Draft payload contains a string longer than ${MAX_DRAFT_STRING_LENGTH} characters.`;
    if (Array.isArray(item)) {
      if (item.length > MAX_DRAFT_ARRAY_ITEMS)
        return `Draft payload contains an array with more than ${MAX_DRAFT_ARRAY_ITEMS} items.`;
      for (const child of item) {
        const issue = visit(child, depth + 1);
        if (issue) return issue;
      }
      return undefined;
    }
    if (!isRecord(item)) return undefined;
    for (const [key, child] of Object.entries(item)) {
      if (FORBIDDEN_JSON_KEYS.has(key)) return `Draft payload contains forbidden key "${key}".`;
      if (key.includes('.')) return `Draft payload key "${key}" must not contain a dot.`;
      if (key.startsWith('$') && key !== '$schema')
        return `Draft payload contains forbidden operator-like key "${key}".`;
      const issue = visit(child, depth + 1);
      if (issue) return issue;
    }
    return undefined;
  };
  return visit(value, 0);
}
function payloadFrom(body: JsonRecord): JsonRecord | undefined {
  return isRecord(body.payload) ? body.payload : undefined;
}
function validationPayload(payload: JsonRecord) {
  return validateCalculatorVersion(payload);
}
function validationError(result: ReturnType<typeof validationPayload>): JsonRecord {
  return {
    publishEligible: result.publishEligible,
    errorCount: result.errorCount,
    warningCount: result.warningCount,
    layers: {
      structural: result.structural,
      semantic: result.semantic,
      clinical: result.clinical,
      publish: result.publish,
    },
  };
}
function parseSlug(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const slug = value.trim().toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : undefined;
}
function parseVersion(value: unknown): number | undefined {
  const version = Number(value);
  return Number.isInteger(version) && version > 0 ? version : undefined;
}
function parseObjectId(value: unknown): Types.ObjectId | undefined {
  return typeof value === 'string' && Types.ObjectId.isValid(value)
    ? new Types.ObjectId(value)
    : undefined;
}
function param(request: Request, name: string): string | undefined {
  const value = request.params[name];
  return typeof value === 'string' ? value : undefined;
}
function actorId(request: AuthenticatedRequest): Types.ObjectId | undefined {
  return request.admin?.id && Types.ObjectId.isValid(request.admin.id)
    ? new Types.ObjectId(request.admin.id)
    : undefined;
}
async function recordAudit(
  request: AuthenticatedRequest,
  action: string,
  entityId: string,
  diffSummary?: JsonRecord,
  entityType = 'CalculatorVersion',
  session?: ClientSession,
): Promise<void> {
  const record = {
    actorId: actorId(request),
    action,
    entityType,
    entityId,
    diffSummary,
  };
  if (session) {
    await AuditLogModel.create([record], { session, ordered: true });
    return;
  }
  await AuditLogModel.create(record);
}

function versionPayload(
  version: {
    readonly _id: Types.ObjectId;
    readonly calculatorSlug: string;
    readonly version: number;
    readonly status: LifecycleStatus;
    readonly payload: unknown;
    readonly versionHash?: string;
    readonly measurementRevisionIds?: readonly string[];
    readonly measurementSnapshots?: readonly unknown[];
    readonly createdBy?: Types.ObjectId;
    readonly lastEditedBy?: Types.ObjectId;
    readonly approvedBy?: Types.ObjectId;
    readonly approvedAt?: Date;
    readonly reviewEvidence?: {
      readonly reviewerId: Types.ObjectId;
      readonly reviewedAt: Date;
      readonly decision: 'approved';
      readonly scope: 'full-version';
      readonly protectedHash: string;
    };
    readonly publishedAt?: Date;
    readonly immutableAt?: Date;
    readonly createdAt?: Date;
    readonly updatedAt?: Date;
  },
  metadata: { readonly changelog?: string } = {},
): JsonRecord {
  return {
    id: version._id.toString(),
    calculatorSlug: version.calculatorSlug,
    version: version.version,
    status: version.status,
    payload: version.payload,
    versionHash: version.versionHash,
    createdBy: version.createdBy?.toString(),
    lastEditedBy: version.lastEditedBy?.toString(),
    approvedBy: version.approvedBy?.toString(),
    approvedAt: version.approvedAt,
    reviewEvidence: version.reviewEvidence
      ? {
          reviewerId: version.reviewEvidence.reviewerId.toString(),
          reviewedAt: version.reviewEvidence.reviewedAt,
          decision: version.reviewEvidence.decision,
          scope: version.reviewEvidence.scope,
          protectedHash: version.reviewEvidence.protectedHash,
        }
      : undefined,
    publishedAt: version.publishedAt,
    immutableAt: version.immutableAt,
    changelog: metadata.changelog,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
    measurements: {
      revisionIds: version.measurementRevisionIds ?? [],
      count: version.measurementSnapshots?.length ?? 0,
    },
  };
}
function versionEtag(version: {
  readonly versionHash?: string;
  readonly updatedAt?: Date;
}): string {
  return `"${jsonHash({ versionHash: version.versionHash, updatedAt: version.updatedAt?.toISOString() })}"`;
}
function setVersionEtag(response: Response, version: Parameters<typeof versionEtag>[0]): string {
  const tag = versionEtag(version);
  response.setHeader('ETag', tag);
  return tag;
}
function ifMatchMatches(
  request: Request,
  version: { versionHash?: string; updatedAt?: Date },
): { readonly ok: boolean; readonly missing: boolean } {
  const header = request.header('if-match');
  if (!header) return { ok: false, missing: true };
  const tag = versionEtag(version);
  const rawHash = version.versionHash;
  const candidates = new Set<string | undefined>([
    tag,
    `W/${tag}`,
    rawHash,
    rawHash ? `"${rawHash}"` : undefined,
  ]);
  return {
    ok: header
      .split(',')
      .map((item) => item.trim())
      .some((item) => candidates.has(item)),
    missing: false,
  };
}
function enforceIfMatch(
  request: Request,
  response: Response,
  version: { versionHash?: string; updatedAt?: Date },
): boolean {
  const match = ifMatchMatches(request, version);
  if (match.missing) {
    sendFailure(
      response,
      428,
      'IF_MATCH_REQUIRED',
      'If-Match is required when advancing or editing a version.',
    );
    return false;
  }
  if (!match.ok) {
    sendFailure(response, 409, 'VERSION_CONFLICT', 'The version changed since it was loaded.');
    return false;
  }
  return true;
}

function testCasesFromPayload(payload: JsonRecord): readonly TestCase[] {
  return Array.isArray(payload.testCases) ? (payload.testCases as TestCase[]) : [];
}
function validateTestCases(
  value: unknown,
): { ok: true; value: readonly TestCase[] } | { ok: false; message: string } {
  if (!Array.isArray(value)) return { ok: false, message: 'testCases must be an array.' };
  if (value.length === 0) return { ok: false, message: 'At least one test case is required.' };
  if (value.length > 100) return { ok: false, message: 'At most 100 test cases may be saved.' };
  const seen = new Set<string>();
  for (const item of value) {
    if (!isRecord(item)) return { ok: false, message: 'Each test case must be an object.' };
    const unknownCaseFields = Object.keys(item).filter(
      (field) => !['key', 'name', 'kind', 'inputs', 'expected', 'source'].includes(field),
    );
    if (unknownCaseFields.length > 0)
      return {
        ok: false,
        message: `Test case contains unsupported fields: ${unknownCaseFields.join(', ')}.`,
      };
    const key = item.key;
    if (typeof key !== 'string' || !/^[A-Za-z][A-Za-z0-9-]{0,99}$/.test(key))
      return { ok: false, message: 'Each test case key must be a valid identifier.' };
    if (seen.has(key)) return { ok: false, message: `Duplicate test case key: ${key}.` };
    seen.add(key);
    if (typeof item.name !== 'string' || item.name.trim().length === 0)
      return { ok: false, message: `Test case ${key} needs a name.` };
    if (typeof item.kind !== 'string' || !TEST_CASE_KINDS.has(item.kind))
      return { ok: false, message: `Test case ${key} has an unsupported kind.` };
    if (!isRecord(item.inputs) || !isRecord(item.expected))
      return { ok: false, message: `Test case ${key} needs inputs and expected objects.` };
    const expected = item.expected;
    const unknownExpectedFields = Object.keys(expected).filter(
      (field) => !['finalScore', 'category', 'traceAssertions', 'errorCode'].includes(field),
    );
    if (unknownExpectedFields.length > 0)
      return {
        ok: false,
        message: `Test case ${key} has unsupported expectations: ${unknownExpectedFields.join(', ')}.`,
      };
    const expectedCount = ['finalScore', 'category', 'errorCode'].filter(
      (field) => expected[field] !== undefined,
    ).length;
    if (expectedCount < 1)
      return { ok: false, message: `Test case ${key} must specify at least one expectation.` };
    if (expected.finalScore !== undefined && typeof expected.finalScore !== 'number')
      return { ok: false, message: `Test case ${key} finalScore must be numeric.` };
    if (expected.category !== undefined && typeof expected.category !== 'string')
      return { ok: false, message: `Test case ${key} category must be a string.` };
    if (expected.errorCode !== undefined && typeof expected.errorCode !== 'string')
      return { ok: false, message: `Test case ${key} errorCode must be a string.` };
    if (
      expected.traceAssertions !== undefined &&
      (!Array.isArray(expected.traceAssertions) ||
        expected.traceAssertions.some(
          (item) => typeof item !== 'string' || item.length === 0 || item.length > 500,
        ))
    )
      return {
        ok: false,
        message: `Test case ${key} traceAssertions must be bounded non-empty strings.`,
      };
  }
  return { ok: true, value: value as TestCase[] };
}
function runTestCases(payload: JsonRecord, cases = testCasesFromPayload(payload)) {
  return cases.map((testCase) => {
    const result = calculate(payload, testCase.inputs, { includeTrace: true });
    const expected = testCase.expected;
    const checks: JsonRecord[] = [];
    if (typeof expected.finalScore === 'number')
      checks.push({ field: 'finalScore', passed: result.score === expected.finalScore });
    if (typeof expected.category === 'string')
      checks.push({ field: 'category', passed: result.category?.label === expected.category });
    if (typeof expected.errorCode === 'string')
      checks.push({
        field: 'errorCode',
        passed: result.errors.some((error) => error.code === expected.errorCode),
      });
    const assertions = Array.isArray(expected.traceAssertions) ? expected.traceAssertions : [];
    for (const assertion of assertions)
      checks.push({
        field: 'traceAssertion',
        assertion,
        passed: typeof assertion === 'string' && JSON.stringify(result.trace).includes(assertion),
      });
    return {
      key: testCase.key,
      passed: checks.length > 0 && checks.every((check) => check.passed === true),
      checks,
      result: {
        ok: result.ok,
        score: result.score,
        category: result.category?.label,
        errors: result.errors,
      },
    };
  });
}
function testRunSummary(payload: JsonRecord) {
  const cases = runTestCases(payload);
  return { passed: cases.length > 0 && cases.every((item) => item.passed), cases };
}
const UNPROTECTED_REVIEW_PAYLOAD_FIELDS = new Set(['status', 'version']);

function protectedReviewPayload(payload: JsonRecord): JsonRecord {
  return Object.fromEntries(
    Object.entries(payload).filter(([field]) => !UNPROTECTED_REVIEW_PAYLOAD_FIELDS.has(field)),
  );
}

export function protectedReviewHash(
  payload: JsonRecord,
  measurementRevisionIds: readonly string[],
  measurementSnapshots: readonly unknown[],
): string {
  return jsonHash({
    envelopeVersion: 'calculator-protected-review.v2',
    payload: protectedReviewPayload(payload),
    measurements: { revisionIds: measurementRevisionIds, snapshots: measurementSnapshots },
  });
}

function unresolvedMedicalReviewPolicy(payload: JsonRecord): boolean {
  const governance = isRecord(payload.governance) ? payload.governance : undefined;
  return !(
    governance?.clinicalStatus === 'not-applicable' &&
    governance.sourceReviewStatus === 'not-applicable'
  );
}

function serverReviewEvidenceIssue(record: {
  readonly approvedBy?: Types.ObjectId;
  readonly approvedAt?: Date;
  readonly lastEditedBy?: Types.ObjectId;
  readonly reviewHash?: string;
  readonly reviewEvidence?: {
    readonly reviewerId: Types.ObjectId;
    readonly reviewedAt: Date;
    readonly decision: 'approved';
    readonly scope: 'full-version';
    readonly protectedHash: string;
  };
}): string | undefined {
  const evidence = record.reviewEvidence;
  if (!record.approvedBy || !record.approvedAt || !record.reviewHash || !evidence)
    return 'Server-owned medical review evidence is incomplete.';
  if (record.lastEditedBy?.equals(record.approvedBy))
    return 'The medical reviewer must be independent from the last protected editor.';
  if (
    !evidence.reviewerId.equals(record.approvedBy) ||
    evidence.reviewedAt.getTime() !== record.approvedAt.getTime() ||
    evidence.decision !== 'approved' ||
    evidence.scope !== 'full-version' ||
    evidence.protectedHash !== record.reviewHash
  )
    return 'Server-owned medical review evidence does not match the protected approval.';
  return undefined;
}

type MeasurementBindingRecord = {
  readonly _id: Types.ObjectId;
  readonly key: string;
  readonly revision: number;
  readonly status: string;
  readonly definition: Record<string, unknown>;
  readonly definitionHash: string;
  readonly sources: unknown[];
  readonly [key: string]: unknown;
};

type MeasurementBindingResult =
  | {
      readonly ok: true;
      readonly revisionIds: readonly string[];
      readonly snapshots: readonly JsonRecord[];
      readonly records: readonly MeasurementBindingRecord[];
    }
  | {
      readonly ok: false;
      readonly code: string;
      readonly message: string;
      readonly fields?: JsonRecord;
    };
type MeasurementBindingFailure = Extract<MeasurementBindingResult, { readonly ok: false }>;

function exactStringArray(value: unknown): readonly string[] | undefined {
  return Array.isArray(value) && value.every((item): item is string => typeof item === 'string')
    ? value
    : undefined;
}

function payloadBiomarkerKeys(payload: JsonRecord): readonly string[] {
  const parameters = Array.isArray(payload.parameters) ? payload.parameters : [];
  return [
    ...new Set(
      parameters.flatMap((parameter) => {
        if (!isRecord(parameter) || typeof parameter.biomarkerKey !== 'string') return [];
        return [parameter.biomarkerKey];
      }),
    ),
  ];
}

function measurementSnapshot(record: MeasurementBindingRecord): JsonRecord {
  return {
    measurementRevisionId: record._id.toString(),
    key: record.key,
    revision: record.revision,
    definitionHash: record.definitionHash,
    definition: record.definition,
    sources: record.sources,
  };
}

async function resolveMeasurementBinding(
  payload: JsonRecord,
  requestedRevisionIds: unknown,
  session?: ClientSession,
): Promise<MeasurementBindingResult> {
  const revisionIds = exactStringArray(requestedRevisionIds);
  if (!revisionIds)
    return {
      ok: false,
      code: 'INVALID_MEASUREMENT_BINDING',
      message: 'measurementRevisionIds must be an array of MongoDB object-id strings.',
    };
  if (revisionIds.length > 200)
    return {
      ok: false,
      code: 'INVALID_MEASUREMENT_BINDING',
      message: 'At most 200 measurement revisions may be bound to one calculator version.',
    };
  if (
    revisionIds.some((id) => !/^[a-f\d]{24}$/i.test(id)) ||
    new Set(revisionIds).size !== revisionIds.length
  )
    return {
      ok: false,
      code: 'INVALID_MEASUREMENT_BINDING',
      message: 'Measurement revision ids must be valid and unique.',
    };

  const governance = isRecord(payload.governance) ? payload.governance : undefined;
  const declaredIds = exactStringArray(governance?.measurementRevisionIds);
  if (revisionIds.length > 0 && !governance)
    return {
      ok: false,
      code: 'MEASUREMENT_BINDING_DIVERGENCE',
      message: 'Payload governance must declare the selected measurement revision ids.',
    };
  if (governance?.measurementRevisionIds !== undefined && !declaredIds)
    return {
      ok: false,
      code: 'MEASUREMENT_BINDING_DIVERGENCE',
      message: 'governance.measurementRevisionIds must be an array of strings.',
    };
  if (!stableMeasurementEqual(declaredIds ?? [], revisionIds))
    return {
      ok: false,
      code: 'MEASUREMENT_BINDING_DIVERGENCE',
      message:
        'Payload governance measurement revision ids must exactly match the persistence binding.',
    };

  const expectedKeys = [...payloadBiomarkerKeys(payload)].sort();
  if (revisionIds.length === 0) {
    if (expectedKeys.length > 0)
      return {
        ok: false,
        code: 'MEASUREMENT_COVERAGE_MISMATCH',
        message: 'Selected measurement revisions must exactly cover parameter biomarker keys.',
        fields: { expectedKeys, actualKeys: [] },
      };
    return { ok: true, revisionIds: [], snapshots: [], records: [] };
  }

  const objectIds = revisionIds.map((id) => new Types.ObjectId(id));
  const measurementQuery = MeasurementRevisionModel.find({ _id: { $in: objectIds } });
  if (session) measurementQuery.session(session);
  const found = (await measurementQuery.lean()) as MeasurementBindingRecord[] | undefined;
  const byId = new Map((found ?? []).map((record) => [record._id.toString(), record]));
  const records = revisionIds.flatMap((id) => {
    const record = byId.get(id);
    return record ? [record] : [];
  });
  if (records.length !== revisionIds.length)
    return {
      ok: false,
      code: 'MEASUREMENT_REVISION_NOT_FOUND',
      message: 'One or more selected measurement revisions do not exist.',
    };
  if (new Set(records.map((record) => record.key)).size !== records.length)
    return {
      ok: false,
      code: 'INVALID_MEASUREMENT_BINDING',
      message: 'A calculator may bind only one revision for each measurement key.',
    };

  const actualKeys = records.map((record) => record.key).sort();
  if (!stableMeasurementEqual(expectedKeys, actualKeys))
    return {
      ok: false,
      code: 'MEASUREMENT_COVERAGE_MISMATCH',
      message: 'Selected measurement revisions must exactly cover parameter biomarker keys.',
      fields: { expectedKeys, actualKeys },
    };
  return {
    ok: true,
    revisionIds,
    snapshots: records.map(measurementSnapshot),
    records,
  };
}

async function measurementApprovalIssue(
  record: {
    readonly payload: unknown;
    readonly measurementRevisionIds: readonly string[];
    readonly measurementSnapshots: readonly unknown[];
  },
  session?: ClientSession,
): Promise<MeasurementBindingFailure | undefined> {
  if (!isRecord(record.payload))
    return {
      ok: false,
      code: 'INVALID_MEASUREMENT_BINDING',
      message: 'The calculator payload is unavailable for measurement verification.',
    };
  const binding = await resolveMeasurementBinding(
    record.payload,
    record.measurementRevisionIds,
    session,
  );
  if (!binding.ok) return binding;
  if (!stableMeasurementEqual(record.measurementSnapshots, binding.snapshots))
    return {
      ok: false,
      code: 'MEASUREMENT_SNAPSHOT_DRIFT',
      message: 'Stored measurement snapshots do not exactly match their immutable revisions.',
    };
  const now = new Date();
  for (const measurement of binding.records) {
    if (!isApprovedMeasurementEnvelope(measurement as JsonRecord, now))
      return {
        ok: false,
        code: 'MEASUREMENT_NOT_VERIFIED',
        message: `Measurement ${measurement.key} revision ${measurement.revision} is not currently publish eligible.`,
      };
  }
  if (binding.records.length === 0) return undefined;
  const keys = binding.records.map((measurement) => measurement.key);
  const verifiedQuery = MeasurementRevisionModel.find({
    key: { $in: keys },
    status: 'verified',
  }).sort({ key: 1, revision: -1 });
  if (session) verifiedQuery.session(session);
  const verified = (await verifiedQuery.lean()) as MeasurementBindingRecord[];
  for (const selected of binding.records) {
    const current = verified.find(
      (candidate) =>
        candidate.key === selected.key && isApprovedMeasurementEnvelope(candidate, now),
    );
    if (!current || !current._id.equals(selected._id))
      return {
        ok: false,
        code: 'MEASUREMENT_REVISION_STALE',
        message: `Measurement ${selected.key} must use its latest eligible verified revision.`,
      };
  }
  return undefined;
}

function sendMeasurementBindingFailure(
  response: Response,
  result: MeasurementBindingFailure,
): void {
  sendFailure(response, 422, result.code, result.message, result.fields);
}

function adminUserPayload(user: {
  readonly _id: Types.ObjectId;
  readonly email: string;
  readonly role: AdminRole;
  readonly status: 'active' | 'disabled';
  readonly failedLoginCount: number;
  readonly lockedUntil?: Date;
  readonly lastLoginAt?: Date;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}): JsonRecord {
  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    status: user.status,
    failedLoginCount: user.failedLoginCount,
    lockedUntil: user.lockedUntil,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
function auditPayload(record: {
  readonly _id: Types.ObjectId;
  readonly actorId?: Types.ObjectId;
  readonly action: string;
  readonly entityType: string;
  readonly entityId?: string;
  readonly diffSummary?: Record<string, unknown>;
  readonly createdAt: Date;
}): JsonRecord {
  return {
    id: record._id.toString(),
    actorId: record.actorId?.toString(),
    action: record.action,
    entityType: record.entityType,
    entityId: record.entityId,
    diffSummary: record.diffSummary,
    createdAt: record.createdAt,
  };
}
function validMeasurementKey(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9._-]{0,149}$/.test(value);
}
function measurementSourcesIssue(sources: readonly unknown[]): string | undefined {
  const acceptedVerification = new Set(['fetch-verified', 'source-provided']);
  for (const [index, source] of sources.entries()) {
    if (!isRecord(source)) return `Source ${index} must be an object.`;
    if (
      typeof source.id !== 'string' ||
      !parseSlug(source.id) ||
      !['niro', 'external', 'internal'].includes(source.type as string) ||
      typeof source.title !== 'string' ||
      source.title.trim().length === 0 ||
      (typeof source.url !== 'string' && typeof source.ref !== 'string')
    )
      return `Source ${index} must have a valid id, type, title, and url or ref.`;
    if (!acceptedVerification.has(source.verification as string))
      return `Source ${index} must be fetch-verified or source-provided before verification.`;
  }
  return undefined;
}

export function measurementDefinitionIssue(
  definition: JsonRecord,
  sources: readonly unknown[],
): string | undefined {
  return sharedMeasurementDefinitionIssue(definition, sources);
}
function measurementPayload(record: {
  readonly _id: Types.ObjectId;
  readonly key: string;
  readonly revision: number;
  readonly status: string;
  readonly displayName: string;
  readonly kind: string;
  readonly canonicalUnit?: string;
  readonly definition: Record<string, unknown>;
  readonly definitionHash: string;
  readonly sources: unknown[];
  readonly reviewedBy?: Types.ObjectId;
  readonly reviewHash?: string;
  readonly verifiedAt?: Date;
  readonly retiredAt?: Date;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}): JsonRecord {
  return {
    id: record._id.toString(),
    key: record.key,
    revision: record.revision,
    status: record.status,
    displayName: record.displayName,
    kind: record.kind,
    canonicalUnit: record.canonicalUnit,
    definition: record.definition,
    definitionHash: record.definitionHash,
    sources: record.sources,
    reviewedBy: record.reviewedBy?.toString(),
    reviewHash: record.reviewHash,
    verifiedAt: record.verifiedAt,
    retiredAt: record.retiredAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export interface AdminRouterOptions {
  readonly onPublish?: (calculatorSlug: string) => void | Promise<void>;
  readonly onRetire?: (calculatorSlug: string) => void | Promise<void>;
}

export class CacheInvalidationHookError extends Error {
  constructor(readonly operation: 'publish' | 'retire') {
    super(`Downstream cache invalidation failed after ${operation}`);
    this.name = 'CacheInvalidationHookError';
  }
}

export function createAdminRouter(
  authService: AuthService | undefined,
  options: AdminRouterOptions = {},
): Router {
  const router = Router();
  router.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
    response.setHeader('X-Robots-Tag', 'noindex, nofollow');
    next();
  });
  if (!authService) {
    router.use((_request, response) => {
      sendFailure(response, 503, 'AUTH_NOT_CONFIGURED', 'Admin authentication is not configured.');
    });
    return router;
  }
  const anyAdmin = requireAdmin(authService);
  const editors = requireAdmin(authService, ['admin', 'editor']);
  const medicalReviewers = requireAdmin(authService, ['medical-reviewer']);
  const publishers = requireAdmin(authService, ['admin', 'medical-reviewer']);
  const owners = requireAdmin(authService, ['admin']);
  async function notifyPublish(slug: string): Promise<void> {
    invalidatePublicCatalogCache(slug);
    try {
      await options.onPublish?.(slug);
    } catch {
      throw new CacheInvalidationHookError('publish');
    }
  }
  async function notifyRetire(slug: string): Promise<void> {
    invalidatePublicCatalogCache(slug);
    try {
      await options.onRetire?.(slug);
    } catch {
      throw new CacheInvalidationHookError('retire');
    }
  }
  async function findVersionBySlugAndNumber(slug: string | undefined, value: unknown) {
    const version = parseVersion(value);
    return slug && version
      ? CalculatorVersionModel.findOne({ calculatorSlug: slug, version })
      : undefined;
  }

  router.get('/users', owners, async (_request, response, next) => {
    try {
      const users = await AdminUserModel.find().sort({ email: 1 }).lean();
      response.json({ data: users.map(adminUserPayload) });
    } catch (error) {
      next(error);
    }
  });
  router.post('/users', owners, async (request: AuthenticatedRequest, response, next) => {
    try {
      if (rejectsUnknownBodyFields(request, response, ['email', 'password', 'role'])) return;
      const body = bodyRecord(request);
      const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
      const password = typeof body?.password === 'string' ? body.password : '';
      const role = body?.role as AdminRole | undefined;
      if (!/^\S+@\S+\.\S+$/.test(email) || !password || !ADMIN_ROLES.includes(role as AdminRole)) {
        sendFailure(
          response,
          422,
          'INVALID_REQUEST',
          'email, password, and a valid role are required.',
        );
        return;
      }
      if (await AdminUserModel.exists({ email })) {
        sendFailure(response, 409, 'USER_EXISTS', 'An admin user with this email already exists.');
        return;
      }
      const user = await AdminUserModel.create({
        email,
        passwordHash: await hashPassword(password),
        role,
        status: 'active',
        failedLoginCount: 0,
      });
      await recordAudit(request, 'admin.user.create', user._id.toString(), { role }, 'AdminUser');
      response.status(201).json({ data: adminUserPayload(user) });
    } catch (error) {
      if (error instanceof Error && error.message.includes('passwords must be at least')) {
        sendFailure(response, 422, 'INVALID_PASSWORD', error.message);
        return;
      }
      next(error);
    }
  });
  router.patch('/users/:id', owners, async (request: AuthenticatedRequest, response, next) => {
    try {
      if (rejectsUnknownBodyFields(request, response, ['role', 'status', 'password'])) return;
      const id = parseObjectId(param(request, 'id'));
      const body = bodyRecord(request);
      if (!id || !body) {
        sendFailure(
          response,
          422,
          'INVALID_REQUEST',
          'A valid user id and update body are required.',
        );
        return;
      }
      const user = await AdminUserModel.findById(id).select('+passwordHash');
      if (!user) {
        sendFailure(response, 404, 'NOT_FOUND', 'Admin user not found.');
        return;
      }
      const requestedStatus = body.status;
      if (
        requestedStatus !== undefined &&
        requestedStatus !== 'active' &&
        requestedStatus !== 'disabled'
      ) {
        sendFailure(response, 422, 'INVALID_REQUEST', 'status must be active or disabled.');
        return;
      }
      const requestedRole = body.role as AdminRole | undefined;
      if (requestedRole !== undefined && !ADMIN_ROLES.includes(requestedRole)) {
        sendFailure(response, 422, 'INVALID_ROLE', 'role is not supported.');
        return;
      }
      if (body.password !== undefined && typeof body.password !== 'string') {
        sendFailure(response, 422, 'INVALID_PASSWORD', 'password must be a string.');
        return;
      }
      const replacementPasswordHash =
        typeof body.password === 'string' ? await hashPassword(body.password) : undefined;
      if (requestedStatus === 'disabled' && request.admin?.id === user._id.toString()) {
        await recordAudit(
          request,
          'admin.user.update.rejected',
          user._id.toString(),
          { reason: 'self-disable' },
          'AdminUser',
        );
        sendFailure(response, 409, 'SELF_DISABLE', 'You cannot disable your own admin account.');
        return;
      }
      const removesActiveAdmin =
        user.role === 'admin' &&
        user.status === 'active' &&
        (requestedStatus === 'disabled' ||
          (requestedRole !== undefined && requestedRole !== 'admin'));
      if (removesActiveAdmin) {
        const result = await withTransaction(async (session) => {
          await AdminGovernanceLockModel.findOneAndUpdate(
            { _id: 'active-admin-invariant' },
            { $inc: { revision: 1 } },
            { upsert: true, new: true, session, setDefaultsOnInsert: true },
          );
          const current = await AdminUserModel.findById(id)
            .select('+passwordHash')
            .session(session);
          if (!current) return { missing: true as const };
          const stillRemovesActiveAdmin =
            current.role === 'admin' &&
            current.status === 'active' &&
            (requestedStatus === 'disabled' ||
              (requestedRole !== undefined && requestedRole !== 'admin'));
          if (
            stillRemovesActiveAdmin &&
            (await AdminUserModel.countDocuments({ role: 'admin', status: 'active' }).session(
              session,
            )) <= 1
          ) {
            await AuditLogModel.create(
              [
                {
                  actorId: actorId(request),
                  action: 'admin.user.update.rejected',
                  entityType: 'AdminUser',
                  entityId: current._id.toString(),
                  diffSummary: { reason: 'last-admin' },
                },
              ],
              { session, ordered: true },
            );
            return { lastAdmin: true as const };
          }
          if (requestedRole !== undefined) current.role = requestedRole;
          if (requestedStatus !== undefined) current.status = requestedStatus;
          if (replacementPasswordHash !== undefined) current.passwordHash = replacementPasswordHash;
          await current.save({ session });
          await AdminSessionModel.updateMany(
            { adminUserId: current._id, revokedAt: { $exists: false } },
            { $set: { revokedAt: new Date() } },
            { session },
          );
          await AuditLogModel.create(
            [
              {
                actorId: actorId(request),
                action: 'admin.user.update',
                entityType: 'AdminUser',
                entityId: current._id.toString(),
                diffSummary: {
                  role: current.role,
                  status: current.status,
                  passwordRotated: replacementPasswordHash !== undefined,
                  sessionsRevoked: true,
                },
              },
            ],
            { session, ordered: true },
          );
          return { user: current };
        });
        if ('missing' in result) {
          sendFailure(response, 404, 'NOT_FOUND', 'Admin user not found.');
          return;
        }
        if ('lastAdmin' in result) {
          sendFailure(
            response,
            409,
            'LAST_ADMIN',
            'At least one active admin account is required.',
          );
          return;
        }
        response.json({ data: adminUserPayload(result.user) });
        return;
      }
      if (requestedRole !== undefined) user.role = requestedRole;
      if (requestedStatus !== undefined) user.status = requestedStatus;
      if (replacementPasswordHash !== undefined) user.passwordHash = replacementPasswordHash;
      await user.save();
      await AdminSessionModel.updateMany(
        { adminUserId: user._id, revokedAt: { $exists: false } },
        { $set: { revokedAt: new Date() } },
      );
      await recordAudit(
        request,
        'admin.user.update',
        user._id.toString(),
        {
          role: user.role,
          status: user.status,
          passwordRotated: replacementPasswordHash !== undefined,
          sessionsRevoked: true,
        },
        'AdminUser',
      );
      response.json({ data: adminUserPayload(user) });
    } catch (error) {
      if (error instanceof Error && error.message.includes('passwords must be at least')) {
        sendFailure(response, 422, 'INVALID_PASSWORD', error.message);
        return;
      }
      next(error);
    }
  });

  router.get('/audit', owners, async (request, response, next) => {
    try {
      const allowedQuery = new Set(['actor', 'action', 'slug', 'from', 'to']);
      const unknown = Object.keys(request.query).filter((key) => !allowedQuery.has(key));
      if (unknown.length > 0) {
        sendFailure(response, 422, 'INVALID_QUERY', 'Unsupported audit query field.', { unknown });
        return;
      }
      const filter: JsonRecord = {};
      if (request.query.actor !== undefined) {
        const actor = parseObjectId(request.query.actor);
        if (!actor) {
          sendFailure(response, 422, 'INVALID_QUERY', 'actor must be a MongoDB object id.');
          return;
        }
        filter.actorId = actor;
      }
      if (request.query.action !== undefined) {
        if (
          typeof request.query.action !== 'string' ||
          !/^[a-z0-9.-]{1,120}$/.test(request.query.action)
        ) {
          sendFailure(response, 422, 'INVALID_QUERY', 'action is invalid.');
          return;
        }
        filter.action = request.query.action;
      }
      if (request.query.slug !== undefined) {
        const slug = parseSlug(request.query.slug);
        if (!slug) {
          sendFailure(response, 422, 'INVALID_QUERY', 'slug is invalid.');
          return;
        }
        const ids = await CalculatorVersionModel.find({ calculatorSlug: slug })
          .select('_id')
          .lean();
        filter.entityId = { $in: ids.map((item) => item._id.toString()) };
      }
      const createdAt: JsonRecord = {};
      for (const [queryKey, operator] of [
        ['from', '$gte'],
        ['to', '$lte'],
      ] as const) {
        const value = request.query[queryKey];
        if (value === undefined) continue;
        if (typeof value !== 'string') {
          sendFailure(response, 422, 'INVALID_QUERY', `${queryKey} must be an ISO date-time.`);
          return;
        }
        const parsed = new Date(value);
        if (!Number.isFinite(parsed.getTime())) {
          sendFailure(response, 422, 'INVALID_QUERY', `${queryKey} must be an ISO date-time.`);
          return;
        }
        createdAt[operator] = parsed;
      }
      if (Object.keys(createdAt).length > 0) filter.createdAt = createdAt;
      const records = await AuditLogModel.find(filter).sort({ createdAt: -1 }).limit(200).lean();
      response.json({ data: records.map(auditPayload) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/calculators', anyAdmin, async (_request, response, next) => {
    try {
      const calculators = await CalculatorModel.find().sort({ slug: 1 }).lean();
      response.json({
        data: calculators.map((calculator) => ({
          id: calculator._id.toString(),
          slug: calculator.slug,
          name: calculator.name,
          status: calculator.status,
          currentVersionId: calculator.currentVersionId?.toString(),
          draftVersionId: calculator.draftVersionId?.toString(),
          updatedAt: calculator.updatedAt,
        })),
      });
    } catch (error) {
      next(error);
    }
  });
  router.post('/calculators', editors, async (request: AuthenticatedRequest, response, next) => {
    try {
      if (
        rejectsUnknownBodyFields(request, response, [
          'slug',
          'name',
          'payload',
          'measurementRevisionIds',
        ])
      )
        return;
      const body = bodyRecord(request);
      const slug = parseSlug(body?.slug);
      const name = typeof body?.name === 'string' ? body.name.trim() : '';
      const payload = body ? payloadFrom(body) : undefined;
      if (!slug || !name || !payload) {
        sendFailure(response, 422, 'INVALID_REQUEST', 'slug, name, and payload are required.');
        return;
      }
      const draftPayload = {
        ...payload,
        calculatorSlug: slug,
        version: 1,
        status: 'draft',
      } as JsonRecord;
      const safetyIssue = draftPayloadSafetyIssue(draftPayload);
      if (safetyIssue) {
        sendFailure(response, 422, 'UNSAFE_DRAFT_PAYLOAD', safetyIssue);
        return;
      }
      const measurementIds = body?.measurementRevisionIds ?? [];
      const binding = await resolveMeasurementBinding(draftPayload, measurementIds);
      if (!binding.ok) {
        sendMeasurementBindingFailure(response, binding);
        return;
      }
      const validation = validationPayload(draftPayload);
      let calculatorExists = false;
      const created = await withTransaction(async (session) => {
        if (await CalculatorModel.exists({ slug }).session(session)) {
          calculatorExists = true;
          return undefined;
        }
        const [calculator] = await CalculatorModel.create(
          [
            {
              slug,
              name,
              status: 'draft',
              createdBy: actorId(request),
            },
          ],
          { session, ordered: true },
        );
        if (!calculator) throw new Error('Calculator identity creation failed.');
        const [version] = await CalculatorVersionModel.create(
          [
            {
              calculatorId: calculator._id,
              calculatorSlug: slug,
              version: 1,
              status: 'draft',
              engineSemanticVersion:
                typeof draftPayload.engineSemanticVersion === 'string'
                  ? draftPayload.engineSemanticVersion
                  : '1.0.0',
              payload: draftPayload,
              measurementRevisionIds: binding.revisionIds,
              measurementSnapshots: binding.snapshots,
              sourceHash: jsonHash(draftPayload),
              logicHash: jsonHash({
                scoringRules: draftPayload.scoringRules,
                formulas: draftPayload.formulas,
              }),
              contentHash: jsonHash(draftPayload.content),
              versionHash: jsonHash({ slug, version: 1, payload: draftPayload }),
              createdBy: actorId(request),
              lastEditedBy: actorId(request),
            },
          ],
          { session, ordered: true },
        );
        if (!version) throw new Error('Calculator version creation failed.');
        calculator.draftVersionId = version._id;
        await calculator.save({ session });
        await recordAudit(
          request,
          'calculator.create',
          version._id.toString(),
          { slug, publishEligible: validation.publishEligible },
          'CalculatorVersion',
          session,
        );
        return { calculator, version };
      });
      if (calculatorExists || !created) {
        sendFailure(
          response,
          409,
          'CALCULATOR_EXISTS',
          'A calculator with this slug already exists.',
        );
        return;
      }
      const { calculator, version } = created;
      setVersionEtag(response, version);
      response.status(201).json({
        data: {
          calculator: { id: calculator._id.toString(), slug, name, status: calculator.status },
          version: versionPayload(version),
          validation: validationError(validation),
        },
      });
    } catch (error) {
      next(error);
    }
  });
  router.get('/calculators/:slug/versions', anyAdmin, async (request, response, next) => {
    try {
      const slug = parseSlug(param(request, 'slug'));
      if (!slug) {
        sendFailure(response, 422, 'INVALID_SLUG', 'Calculator slug is invalid.');
        return;
      }
      const versions = await CalculatorVersionModel.find({
        calculatorSlug: slug,
      })
        .sort({ version: -1 })
        .lean();
      const versionIds = versions.map((version) => version._id.toString());
      const publishAudits = await AuditLogModel.find({
        entityType: 'CalculatorVersion',
        entityId: { $in: versionIds },
        action: { $in: ['calculator.version.publish', 'calculator.version.publish.rollback'] },
      })
        .sort({ createdAt: -1 })
        .lean();
      const changelogByVersion = new Map<string, string>();
      for (const audit of publishAudits) {
        if (!audit.entityId || changelogByVersion.has(audit.entityId)) continue;
        const changelog = isRecord(audit.diffSummary) ? audit.diffSummary.changelog : undefined;
        if (typeof changelog === 'string') changelogByVersion.set(audit.entityId, changelog);
      }
      response.json({
        data: versions.map((version) =>
          versionPayload(version, { changelog: changelogByVersion.get(version._id.toString()) }),
        ),
      });
    } catch (error) {
      next(error);
    }
  });
  router.get('/calculators/:slug/versions/:version', anyAdmin, async (request, response, next) => {
    try {
      const record = await findVersionBySlugAndNumber(
        parseSlug(param(request, 'slug')),
        param(request, 'version'),
      );
      if (!record) {
        sendFailure(response, 404, 'NOT_FOUND', 'Calculator version not found.');
        return;
      }
      setVersionEtag(response, record);
      response.json({ data: versionPayload(record) });
    } catch (error) {
      next(error);
    }
  });
  router.post(
    '/calculators/:slug/versions',
    editors,
    async (request: AuthenticatedRequest, response, next) => {
      try {
        if (
          rejectsUnknownBodyFields(request, response, [
            'sourceVersion',
            'payload',
            'measurementRevisionIds',
          ])
        )
          return;
        const body = bodyRecord(request);
        const slug = parseSlug(param(request, 'slug'));
        const sourceVersion =
          body?.sourceVersion === undefined ? undefined : parseVersion(body.sourceVersion);
        const payload = body ? payloadFrom(body) : undefined;
        let failure:
          | {
              readonly status: number;
              readonly code: string;
              readonly message: string;
              readonly fields?: JsonRecord;
            }
          | undefined;
        const version = await withTransaction(async (session) => {
          const calculator = slug
            ? await CalculatorModel.findOne({ slug }).session(session)
            : undefined;
          if (!calculator) {
            failure = { status: 404, code: 'NOT_FOUND', message: 'Calculator not found.' };
            return undefined;
          }
          const latest = await CalculatorVersionModel.findOne({ calculatorId: calculator._id })
            .sort({ version: -1 })
            .session(session)
            .lean();
          const source =
            sourceVersion === undefined
              ? latest
              : await CalculatorVersionModel.findOne({
                  calculatorId: calculator._id,
                  version: sourceVersion,
                })
                  .session(session)
                  .lean();
          const nextPayload = payload ?? (source?.payload as JsonRecord | undefined);
          if (!nextPayload) {
            failure = {
              status: 422,
              code: 'INVALID_REQUEST',
              message: 'payload or a valid sourceVersion is required.',
            };
            return undefined;
          }
          const nextVersion = (latest?.version ?? 0) + 1;
          const draftPayload = {
            ...nextPayload,
            calculatorSlug: calculator.slug,
            version: nextVersion,
            status: 'draft',
          } as JsonRecord;
          const safetyIssue = draftPayloadSafetyIssue(draftPayload);
          if (safetyIssue) {
            failure = { status: 422, code: 'UNSAFE_DRAFT_PAYLOAD', message: safetyIssue };
            return undefined;
          }
          const candidateIds = body?.measurementRevisionIds ?? source?.measurementRevisionIds ?? [];
          const binding = await resolveMeasurementBinding(draftPayload, candidateIds, session);
          if (!binding.ok) {
            failure = {
              status: 422,
              code: binding.code,
              message: binding.message,
              fields: binding.fields,
            };
            return undefined;
          }
          const [createdVersion] = await CalculatorVersionModel.create(
            [
              {
                calculatorId: calculator._id,
                calculatorSlug: calculator.slug,
                version: nextVersion,
                status: 'draft',
                engineSemanticVersion:
                  typeof draftPayload.engineSemanticVersion === 'string'
                    ? draftPayload.engineSemanticVersion
                    : (source?.engineSemanticVersion ?? '1.0.0'),
                payload: draftPayload,
                measurementRevisionIds: binding.revisionIds,
                measurementSnapshots: binding.snapshots,
                sourceHash: jsonHash(draftPayload),
                logicHash: jsonHash({
                  scoringRules: draftPayload.scoringRules,
                  formulas: draftPayload.formulas,
                }),
                contentHash: jsonHash(draftPayload.content),
                versionHash: jsonHash({
                  slug: calculator.slug,
                  version: nextVersion,
                  payload: draftPayload,
                }),
                createdBy: actorId(request),
                lastEditedBy: actorId(request),
              },
            ],
            { session, ordered: true },
          );
          if (!createdVersion) throw new Error('Calculator version creation failed.');
          calculator.draftVersionId = createdVersion._id;
          await calculator.save({ session });
          await recordAudit(
            request,
            'calculator.version.create',
            createdVersion._id.toString(),
            { sourceVersion: source?.version },
            'CalculatorVersion',
            session,
          );
          return createdVersion;
        });
        if (failure) {
          sendFailure(response, failure.status, failure.code, failure.message, failure.fields);
          return;
        }
        if (!version) throw new Error('Calculator version creation failed.');
        setVersionEtag(response, version);
        response.status(201).json({ data: versionPayload(version) });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    '/calculators/:slug/versions/:version/submit-review',
    editors,
    async (request: AuthenticatedRequest, response, next) => {
      try {
        if (rejectsUnknownBodyFields(request, response, [])) return;
        const record = await findVersionBySlugAndNumber(
          parseSlug(param(request, 'slug')),
          param(request, 'version'),
        );
        if (!record) {
          sendFailure(response, 404, 'NOT_FOUND', 'Calculator version not found.');
          return;
        }
        if (!enforceIfMatch(request, response, record)) return;
        const reviewPayload = { ...(record.payload as JsonRecord), status: 'in-review' };
        const measurementBinding = await resolveMeasurementBinding(
          reviewPayload,
          record.measurementRevisionIds ?? [],
        );
        if (!measurementBinding.ok) {
          sendMeasurementBindingFailure(response, measurementBinding);
          return;
        }
        if (
          !stableMeasurementEqual(record.measurementSnapshots ?? [], measurementBinding.snapshots)
        ) {
          sendFailure(
            response,
            422,
            'MEASUREMENT_SNAPSHOT_DRIFT',
            'Stored measurement snapshots do not exactly match their selected revisions.',
          );
          return;
        }
        const validation = validationPayload(reviewPayload);
        if (!validation.structural.passed || !validation.semantic.passed) {
          sendFailure(
            response,
            422,
            'VALIDATION_FAILED',
            'Structural and semantic validation must pass before review.',
            validationError(validation),
          );
          return;
        }
        assertVersionTransition(record.status, 'in-review');
        record.payload = reviewPayload;
        record.status = 'in-review';
        record.versionHash = jsonHash({
          slug: record.calculatorSlug,
          version: record.version,
          payload: reviewPayload,
        });
        await record.save();
        await recordAudit(request, 'calculator.version.submit-review', record._id.toString(), {
          version: record.version,
        });
        setVersionEtag(response, record);
        response.json({ data: versionPayload(record), validation: validationError(validation) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/calculators/:slug/versions/:version/validate',
    anyAdmin,
    async (request, response, next) => {
      try {
        if (rejectsUnknownBodyFields(request, response, [])) return;
        const record = await findVersionBySlugAndNumber(
          parseSlug(param(request, 'slug')),
          param(request, 'version'),
        );
        if (!record) {
          sendFailure(response, 404, 'NOT_FOUND', 'Calculator version not found.');
          return;
        }
        response.json({ data: validationError(validationPayload(record.payload as JsonRecord)) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/calculators/:slug/versions/:version/preview',
    anyAdmin,
    async (request, response, next) => {
      try {
        if (rejectsUnknownBodyFields(request, response, ['inputs'])) return;
        const record = await findVersionBySlugAndNumber(
          parseSlug(param(request, 'slug')),
          param(request, 'version'),
        );
        const inputs = bodyRecord(request)?.inputs;
        if (!record) {
          sendFailure(response, 404, 'NOT_FOUND', 'Calculator version not found.');
          return;
        }
        if (!isRecord(inputs)) {
          sendFailure(response, 422, 'INVALID_REQUEST', 'inputs must be an object.');
          return;
        }
        const validation = validationPayload(record.payload as JsonRecord);
        if (!validation.structural.passed || !validation.semantic.passed) {
          sendFailure(
            response,
            422,
            'VALIDATION_FAILED',
            'This draft is not executable.',
            validationError(validation),
          );
          return;
        }
        const result = calculate(record.payload, inputs, { includeTrace: true });
        response.json({ data: { version: versionPayload(record), result } });
      } catch (error) {
        next(error);
      }
    },
  );
  router.get(
    '/calculators/:slug/versions/:version/test-cases',
    anyAdmin,
    async (request, response, next) => {
      try {
        const record = await findVersionBySlugAndNumber(
          parseSlug(param(request, 'slug')),
          param(request, 'version'),
        );
        if (!record) {
          sendFailure(response, 404, 'NOT_FOUND', 'Calculator version not found.');
          return;
        }
        response.json({ data: testCasesFromPayload(record.payload as JsonRecord) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.put(
    '/calculators/:slug/versions/:version/test-cases',
    editors,
    async (request: AuthenticatedRequest, response, next) => {
      try {
        if (rejectsUnknownBodyFields(request, response, ['testCases'])) return;
        const record = await findVersionBySlugAndNumber(
          parseSlug(param(request, 'slug')),
          param(request, 'version'),
        );
        if (!record) {
          sendFailure(response, 404, 'NOT_FOUND', 'Calculator version not found.');
          return;
        }
        assertVersionMutable(record.status);
        const parsed = validateTestCases(bodyRecord(request)?.testCases);
        if (!parsed.ok) {
          sendFailure(response, 422, 'INVALID_TEST_CASES', parsed.message);
          return;
        }
        const match = ifMatchMatches(request, record);
        if (match.missing) {
          sendFailure(
            response,
            428,
            'IF_MATCH_REQUIRED',
            'If-Match is required when editing a version.',
          );
          return;
        }
        if (!match.ok) {
          sendFailure(response, 409, 'VERSION_CONFLICT', 'The draft changed since it was loaded.');
          return;
        }
        record.payload = { ...record.payload, status: 'draft', testCases: parsed.value };
        record.status = 'draft';
        record.approvedBy = undefined;
        record.approvedAt = undefined;
        record.reviewEvidence = undefined;
        record.reviewHash = undefined;
        record.lastEditedBy = actorId(request);
        record.sourceHash = jsonHash(record.payload);
        record.versionHash = jsonHash({
          slug: record.calculatorSlug,
          version: record.version,
          payload: record.payload,
        });
        record.contentHash = jsonHash(record.payload.content);
        await record.save();
        await recordAudit(request, 'calculator.version.test-cases.update', record._id.toString(), {
          count: parsed.value.length,
        });
        setVersionEtag(response, record);
        response.json({ data: { version: versionPayload(record), testCases: parsed.value } });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/calculators/:slug/versions/:version/test-cases/run',
    editors,
    async (request, response, next) => {
      try {
        if (rejectsUnknownBodyFields(request, response, [])) return;
        const record = await findVersionBySlugAndNumber(
          parseSlug(param(request, 'slug')),
          param(request, 'version'),
        );
        if (!record) {
          sendFailure(response, 404, 'NOT_FOUND', 'Calculator version not found.');
          return;
        }
        response.json({ data: testRunSummary(record.payload as JsonRecord) });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    '/calculators/:slug/versions/:version/approve',
    medicalReviewers,
    async (request: AuthenticatedRequest, response, next) => {
      try {
        if (rejectsUnknownBodyFields(request, response, [])) return;
        const record = await findVersionBySlugAndNumber(
          parseSlug(param(request, 'slug')),
          param(request, 'version'),
        );
        if (!record) {
          sendFailure(response, 404, 'NOT_FOUND', 'Calculator version not found.');
          return;
        }
        if (!enforceIfMatch(request, response, record)) return;
        const reviewerId = actorId(request);
        const lastProtectedEditor = record.lastEditedBy ?? record.createdBy;
        if (!reviewerId || lastProtectedEditor?.equals(reviewerId)) {
          sendFailure(
            response,
            409,
            'INDEPENDENT_REVIEW_REQUIRED',
            'The medical reviewer must be independent from the last protected editor.',
          );
          return;
        }
        const approvedPayload = {
          ...(record.payload as JsonRecord),
          status: 'approved',
        } as JsonRecord;
        if (unresolvedMedicalReviewPolicy(approvedPayload)) {
          sendFailure(
            response,
            422,
            'MEDICAL_REVIEW_POLICY_UNRESOLVED',
            'Named reviewer credentials, jurisdiction, and review cadence remain unresolved for medical publication.',
          );
          return;
        }
        const measurementIssue = await measurementApprovalIssue(record);
        if (measurementIssue && !measurementIssue.ok) {
          sendMeasurementBindingFailure(response, measurementIssue);
          return;
        }
        const validation = validationPayload(approvedPayload);
        if (!validation.publishEligible) {
          sendFailure(
            response,
            422,
            'PUBLISH_VALIDATION_FAILED',
            'This version is not eligible for publication.',
            validationError(validation),
          );
          return;
        }
        const tests = testRunSummary(approvedPayload);
        if (!tests.passed) {
          sendFailure(
            response,
            422,
            'TEST_CASES_FAILED',
            'All saved test cases must pass before approval.',
            tests,
          );
          return;
        }
        assertVersionTransition(record.status, 'approved');
        record.payload = approvedPayload;
        record.status = 'approved';
        record.approvedBy = reviewerId;
        record.reviewHash = protectedReviewHash(
          approvedPayload,
          record.measurementRevisionIds,
          record.measurementSnapshots,
        );
        const approvedAt = new Date();
        record.approvedAt = approvedAt;
        record.reviewEvidence = {
          reviewerId,
          reviewedAt: approvedAt,
          decision: 'approved',
          scope: 'full-version',
          protectedHash: record.reviewHash,
        };
        record.sourceHash = jsonHash(approvedPayload);
        record.logicHash = jsonHash({
          scoringRules: approvedPayload.scoringRules,
          formulas: approvedPayload.formulas,
        });
        record.contentHash = jsonHash(approvedPayload.content);
        record.versionHash = jsonHash({
          slug: record.calculatorSlug,
          version: record.version,
          payload: approvedPayload,
        });
        await record.save();
        await recordAudit(request, 'calculator.version.approve', record._id.toString(), {
          version: record.version,
          reviewHash: record.reviewHash,
        });
        setVersionEtag(response, record);
        response.json({
          data: versionPayload(record),
          validation: validationError(validation),
          tests,
        });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/calculators/:slug/versions/:version/publish',
    publishers,
    async (request: AuthenticatedRequest, response, next) => {
      try {
        if (rejectsUnknownBodyFields(request, response, ['changelog'])) return;
        const publishBody = bodyRecord(request) ?? {};
        const changelog = publishBody.changelog;
        if (
          changelog !== undefined &&
          (typeof changelog !== 'string' ||
            changelog.trim().length === 0 ||
            changelog.length > 2000)
        ) {
          sendFailure(response, 422, 'INVALID_REQUEST', 'changelog must be a bounded string.');
          return;
        }
        const record = await findVersionBySlugAndNumber(
          parseSlug(param(request, 'slug')),
          param(request, 'version'),
        );
        if (!record) {
          sendFailure(response, 404, 'NOT_FOUND', 'Calculator version not found.');
          return;
        }
        if (!enforceIfMatch(request, response, record)) return;
        const calculator = await CalculatorModel.findById(record.calculatorId);
        if (!calculator) {
          sendFailure(response, 404, 'NOT_FOUND', 'Calculator identity not found.');
          return;
        }
        const validation = validationPayload(record.payload as JsonRecord);
        if (unresolvedMedicalReviewPolicy(record.payload as JsonRecord)) {
          sendFailure(
            response,
            422,
            'MEDICAL_REVIEW_POLICY_UNRESOLVED',
            'Named reviewer credentials, jurisdiction, and review cadence remain unresolved for medical publication.',
          );
          return;
        }
        if (!validation.publishEligible) {
          sendFailure(
            response,
            422,
            'PUBLISH_VALIDATION_FAILED',
            'This version is not eligible for publication.',
            validationError(validation),
          );
          return;
        }
        const currentReviewHash = protectedReviewHash(
          record.payload as JsonRecord,
          record.measurementRevisionIds,
          record.measurementSnapshots,
        );
        if (!record.reviewHash || record.reviewHash !== currentReviewHash) {
          sendFailure(
            response,
            422,
            'REVIEW_STALE',
            'Protected logic, content, measurement, citation, or test evidence changed after approval.',
          );
          return;
        }
        const reviewEvidenceIssue = serverReviewEvidenceIssue(record);
        if (reviewEvidenceIssue) {
          sendFailure(response, 422, 'REVIEW_STALE', reviewEvidenceIssue);
          return;
        }
        const measurementIssue = await measurementApprovalIssue(record);
        if (measurementIssue && !measurementIssue.ok) {
          sendMeasurementBindingFailure(response, measurementIssue);
          return;
        }
        const tests = testRunSummary(record.payload as JsonRecord);
        if (!tests.passed) {
          sendFailure(
            response,
            422,
            'TEST_CASES_FAILED',
            'All saved test cases must pass before publication.',
            tests,
          );
          return;
        }
        const published = await publishVersionAtomically({
          calculatorId: calculator._id,
          versionId: record._id,
          expectedVersionHash: record.versionHash,
          audit: {
            actorId: actorId(request),
            action: 'calculator.version.publish',
            diffSummary: {
              version: record.version,
              reviewHash: record.reviewHash,
              ...(typeof changelog === 'string' ? { changelog: changelog.trim() } : {}),
            },
          },
          assertPublishEligible: async (transactionalVersion, session) => {
            const transactionalPayload = transactionalVersion.payload as JsonRecord;
            const transactionalValidation = validationPayload(transactionalPayload);
            if (!transactionalValidation.publishEligible)
              throw new Error('Version is not publish eligible');
            if (unresolvedMedicalReviewPolicy(transactionalPayload))
              throw new Error('Medical review policy is unresolved');
            const reviewIssue = serverReviewEvidenceIssue(transactionalVersion);
            if (reviewIssue) throw new Error(reviewIssue);
            const transactionalMeasurementIssue = await measurementApprovalIssue(
              transactionalVersion,
              session,
            );
            if (transactionalMeasurementIssue)
              throw new Error(transactionalMeasurementIssue.message);
          },
        });
        await notifyPublish(published.calculatorSlug);
        setVersionEtag(response, published);
        response.json({
          data: versionPayload(published),
          validation: validationError(validation),
          tests,
        });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/calculators/:slug/versions/:version/retire',
    owners,
    async (request: AuthenticatedRequest, response, next) => {
      try {
        if (rejectsUnknownBodyFields(request, response, [])) return;
        const record = await findVersionBySlugAndNumber(
          parseSlug(param(request, 'slug')),
          param(request, 'version'),
        );
        if (!record) {
          sendFailure(response, 404, 'NOT_FOUND', 'Calculator version not found.');
          return;
        }
        if (!enforceIfMatch(request, response, record)) return;
        const retired = await retireVersionAtomically({
          calculatorId: record.calculatorId,
          versionId: record._id,
          actorId: actorId(request),
        });
        await notifyRetire(retired.calculatorSlug);
        setVersionEtag(response, retired);
        response.json({ data: versionPayload(retired) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.patch(
    '/calculators/:slug/versions/:version',
    editors,
    async (request: AuthenticatedRequest, response, next) => {
      try {
        if (rejectsUnknownBodyFields(request, response, ['payload', 'measurementRevisionIds']))
          return;
        const record = await findVersionBySlugAndNumber(
          parseSlug(param(request, 'slug')),
          param(request, 'version'),
        );
        if (!record) {
          sendFailure(response, 404, 'NOT_FOUND', 'Calculator version not found.');
          return;
        }
        assertVersionMutable(record.status);
        const match = ifMatchMatches(request, record);
        if (match.missing) {
          sendFailure(
            response,
            428,
            'IF_MATCH_REQUIRED',
            'If-Match is required when editing a version.',
          );
          return;
        }
        if (!match.ok) {
          sendFailure(response, 409, 'VERSION_CONFLICT', 'The draft changed since it was loaded.');
          return;
        }
        const suppliedPayload = payloadFrom(bodyRecord(request) ?? {});
        if (!suppliedPayload) {
          sendFailure(response, 422, 'INVALID_REQUEST', 'payload is required.');
          return;
        }
        const payload = {
          ...suppliedPayload,
          calculatorSlug: record.calculatorSlug,
          version: record.version,
          status: 'draft',
        } as JsonRecord;
        const safetyIssue = draftPayloadSafetyIssue(payload);
        if (safetyIssue) {
          sendFailure(response, 422, 'UNSAFE_DRAFT_PAYLOAD', safetyIssue);
          return;
        }
        const body = bodyRecord(request) ?? {};
        const binding = await resolveMeasurementBinding(
          payload,
          body.measurementRevisionIds ?? record.measurementRevisionIds ?? [],
        );
        if (!binding.ok) {
          sendMeasurementBindingFailure(response, binding);
          return;
        }
        record.payload = payload;
        record.status = 'draft';
        record.approvedBy = undefined;
        record.approvedAt = undefined;
        record.reviewEvidence = undefined;
        record.reviewHash = undefined;
        record.lastEditedBy = actorId(request);
        record.measurementRevisionIds = [...binding.revisionIds];
        record.measurementSnapshots = [...binding.snapshots];
        record.sourceHash = jsonHash(payload);
        record.logicHash = jsonHash({
          scoringRules: payload.scoringRules,
          formulas: payload.formulas,
        });
        record.contentHash = jsonHash(payload.content);
        record.versionHash = jsonHash({
          slug: record.calculatorSlug,
          version: record.version,
          payload,
        });
        await record.save();
        await recordAudit(request, 'calculator.version.update', record._id.toString(), {
          version: record.version,
        });
        setVersionEtag(response, record);
        response.json({ data: versionPayload(record) });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    '/calculators/:slug/rollback',
    anyAdmin,
    async (request: AuthenticatedRequest, response, next) => {
      try {
        if (
          rejectsUnknownBodyFields(request, response, [
            'sourceVersion',
            'sourceVersionId',
            'publish',
          ])
        )
          return;
        const slug = parseSlug(param(request, 'slug'));
        const body = bodyRecord(request) ?? {};
        if (body.publish !== undefined && typeof body.publish !== 'boolean') {
          sendFailure(response, 422, 'INVALID_REQUEST', 'publish must be a Boolean when supplied.');
          return;
        }
        const publishRequested = body.publish === true;
        const role = request.admin?.role;
        const roleAllowed = publishRequested
          ? role === 'admin' || role === 'medical-reviewer'
          : role === 'admin';
        if (!roleAllowed) {
          sendFailure(
            response,
            403,
            'FORBIDDEN',
            publishRequested
              ? 'This admin role cannot publish a rollback.'
              : 'Only an administrator can create a draft rollback.',
          );
          return;
        }
        const calculator = slug ? await CalculatorModel.findOne({ slug }) : undefined;
        if (!calculator) {
          sendFailure(response, 404, 'NOT_FOUND', 'Calculator not found.');
          return;
        }
        const sourceVersion = parseVersion(body.sourceVersion);
        const sourceId = parseObjectId(body.sourceVersionId);
        if (!sourceVersion && !sourceId) {
          sendFailure(
            response,
            422,
            'INVALID_REQUEST',
            'An explicit sourceVersion or sourceVersionId is required.',
          );
          return;
        }
        const source = sourceId
          ? await CalculatorVersionModel.findOne({ _id: sourceId, calculatorId: calculator._id })
          : await CalculatorVersionModel.findOne({
              calculatorId: calculator._id,
              version: sourceVersion,
            });
        if (!source) {
          sendFailure(response, 404, 'NOT_FOUND', 'Rollback source version not found.');
          return;
        }
        if (source.status !== 'published' && source.status !== 'retired') {
          sendFailure(
            response,
            409,
            'VERSION_IMMUTABLE_REQUIRED',
            'Rollback requires a published or retired source version.',
          );
          return;
        }
        const sourcePayload = source.payload as JsonRecord;
        const sourceReviewHash = protectedReviewHash(
          sourcePayload,
          source.measurementRevisionIds,
          source.measurementSnapshots,
        );
        const reviewCurrent = Boolean(
          source.reviewHash &&
          source.reviewHash === sourceReviewHash &&
          !serverReviewEvidenceIssue(source) &&
          !unresolvedMedicalReviewPolicy(sourcePayload),
        );
        const sourceMeasurementIssue = publishRequested
          ? await measurementApprovalIssue(source)
          : undefined;
        const latest = await CalculatorVersionModel.findOne({ calculatorId: calculator._id })
          .sort({ version: -1 })
          .lean();
        const proposedVersion = (latest?.version ?? 0) + 1;
        const proposedPayload = {
          ...(JSON.parse(JSON.stringify(source.payload)) as JsonRecord),
          calculatorSlug: calculator.slug,
          version: proposedVersion,
          status: 'approved',
        } as JsonRecord;
        const proposedValidation = validationPayload(proposedPayload);
        const proposedTests = testRunSummary(proposedPayload);
        const immediateEligible =
          publishRequested &&
          reviewCurrent &&
          !sourceMeasurementIssue &&
          proposedValidation.publishEligible &&
          proposedTests.passed;
        if (immediateEligible) {
          const result = await rollbackVersionAtomically({
            calculatorId: calculator._id,
            sourceVersionId: source._id,
            actorId: actorId(request),
            prepare: ({ source: transactionalSource, nextVersion }) => {
              const payload = {
                ...(JSON.parse(JSON.stringify(transactionalSource.payload)) as JsonRecord),
                calculatorSlug: calculator.slug,
                version: nextVersion,
                status: 'approved',
              } as JsonRecord;
              return {
                payload,
                sourceHash: jsonHash(payload),
                logicHash: jsonHash({
                  scoringRules: payload.scoringRules,
                  formulas: payload.formulas,
                }),
                contentHash: jsonHash(payload.content),
                reviewHash: transactionalSource.reviewHash,
                versionHash: jsonHash({ slug: calculator.slug, version: nextVersion, payload }),
              };
            },
            assertPublishEligible: async (payload, transactionalSource, session) => {
              const validation = validationPayload(payload);
              const tests = testRunSummary(payload);
              const reviewIssue = serverReviewEvidenceIssue(transactionalSource);
              const measurementIssue = await measurementApprovalIssue(transactionalSource, session);
              if (
                !validation.publishEligible ||
                !tests.passed ||
                unresolvedMedicalReviewPolicy(payload) ||
                reviewIssue ||
                measurementIssue
              )
                throw new Error('Rollback no longer satisfies publication and required-test gates');
            },
          });
          await notifyPublish(result.calculatorSlug);
          setVersionEtag(response, result);
          response.status(201).json({
            data: {
              version: versionPayload(result),
              sourceVersion: source.version,
              published: true,
              reviewCarriedForward: true,
            },
          });
          return;
        }
        if (publishRequested && role !== 'admin') {
          sendFailure(
            response,
            422,
            'ROLLBACK_REVIEW_REQUIRED',
            'The rollback no longer satisfies current review, measurement, validation, or test gates; an administrator must create a draft for new review.',
          );
          return;
        }
        const reviewRequired =
          publishRequested &&
          (!reviewCurrent ||
            Boolean(sourceMeasurementIssue) ||
            !proposedValidation.publishEligible ||
            !proposedTests.passed);
        const version = await withTransaction(async (session) => {
          const transactionalCalculator = await CalculatorModel.findById(calculator._id).session(
            session,
          );
          const transactionalSource = await CalculatorVersionModel.findOne({
            _id: source._id,
            calculatorId: calculator._id,
            status: { $in: ['published', 'retired'] },
          }).session(session);
          if (!transactionalCalculator || !transactionalSource)
            throw new Error('Rollback source was not found.');
          const latest = await CalculatorVersionModel.findOne({ calculatorId: calculator._id })
            .sort({ version: -1 })
            .session(session)
            .lean();
          const nextVersion = (latest?.version ?? 0) + 1;
          const payload = {
            ...(JSON.parse(JSON.stringify(transactionalSource.payload)) as JsonRecord),
            calculatorSlug: transactionalCalculator.slug,
            version: nextVersion,
            status: 'draft',
          } as JsonRecord;
          const [createdVersion] = await CalculatorVersionModel.create(
            [
              {
                calculatorId: transactionalCalculator._id,
                calculatorSlug: transactionalCalculator.slug,
                version: nextVersion,
                status: 'draft',
                engineSemanticVersion: transactionalSource.engineSemanticVersion,
                payload,
                measurementRevisionIds: transactionalSource.measurementRevisionIds,
                measurementSnapshots: transactionalSource.measurementSnapshots,
                sourceHash: jsonHash(payload),
                logicHash: jsonHash({
                  scoringRules: payload.scoringRules,
                  formulas: payload.formulas,
                }),
                contentHash: jsonHash(payload.content),
                versionHash: jsonHash({
                  slug: transactionalCalculator.slug,
                  version: nextVersion,
                  payload,
                }),
                createdBy: actorId(request),
                lastEditedBy: actorId(request),
              },
            ],
            { session, ordered: true },
          );
          if (!createdVersion) throw new Error('Rollback draft creation failed.');
          transactionalCalculator.draftVersionId = createdVersion._id;
          await transactionalCalculator.save({ session });
          await recordAudit(
            request,
            'calculator.version.rollback',
            createdVersion._id.toString(),
            {
              sourceVersion: transactionalSource.version,
              published: false,
              publishRequested,
              reviewRequired,
            },
            'CalculatorVersion',
            session,
          );
          return createdVersion;
        });
        setVersionEtag(response, version);
        response.status(201).json({
          data: {
            version: versionPayload(version),
            sourceVersion: source.version,
            published: false,
            reviewRequired,
            validation: publishRequested ? validationError(proposedValidation) : undefined,
            tests: publishRequested ? proposedTests : undefined,
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get('/biomarkers', anyAdmin, async (request, response, next) => {
    try {
      const unknownQuery = Object.keys(request.query).filter((key) => key !== 'status');
      if (unknownQuery.length > 0) {
        sendFailure(response, 422, 'INVALID_QUERY', 'Unsupported biomarker query field.', {
          unknown: unknownQuery,
        });
        return;
      }
      const filter: JsonRecord = {};
      if (request.query.status !== undefined) {
        if (
          typeof request.query.status !== 'string' ||
          !['draft', 'verified', 'retired'].includes(request.query.status)
        ) {
          sendFailure(response, 422, 'INVALID_QUERY', 'status is invalid.');
          return;
        }
        filter.status = request.query.status;
      }
      const records = await MeasurementRevisionModel.find(filter)
        .sort({ key: 1, revision: -1 })
        .limit(500)
        .lean();
      response.json({ data: records.map(measurementPayload) });
    } catch (error) {
      next(error);
    }
  });
  router.get('/biomarkers/:key', anyAdmin, async (request, response, next) => {
    try {
      const key = param(request, 'key');
      if (!validMeasurementKey(key)) {
        sendFailure(response, 422, 'INVALID_KEY', 'Biomarker key is invalid.');
        return;
      }
      const record = await MeasurementRevisionModel.findOne({ key }).sort({ revision: -1 }).lean();
      if (!record) {
        sendFailure(response, 404, 'NOT_FOUND', 'Biomarker not found.');
        return;
      }
      response.json({ data: measurementPayload(record) });
    } catch (error) {
      next(error);
    }
  });
  router.post('/biomarkers', owners, async (request: AuthenticatedRequest, response, next) => {
    try {
      if (
        rejectsUnknownBodyFields(request, response, [
          'key',
          'displayName',
          'kind',
          'canonicalUnit',
          'definition',
          'status',
          'sources',
        ])
      )
        return;
      const body = bodyRecord(request) ?? {};
      const key = body.key;
      const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
      const kind = body.kind;
      const definition = isRecord(body.definition) ? body.definition : undefined;
      const sources = Array.isArray(body.sources) ? body.sources : [];
      const status = body.status ?? 'draft';
      if (
        !validMeasurementKey(key) ||
        !displayName ||
        !['biomarker', 'demographic', 'lifestyle', 'derived'].includes(kind as string) ||
        !definition ||
        status !== 'draft'
      ) {
        sendFailure(
          response,
          422,
          'INVALID_REQUEST',
          'key, displayName, kind, definition, and draft status are required.',
        );
        return;
      }
      const latest = await MeasurementRevisionModel.findOne({ key }).sort({ revision: -1 }).lean();
      const record = await MeasurementRevisionModel.create({
        key,
        revision: (latest?.revision ?? 0) + 1,
        status: 'draft',
        displayName,
        kind,
        canonicalUnit: typeof body.canonicalUnit === 'string' ? body.canonicalUnit : undefined,
        definition,
        definitionHash: stableMeasurementHash(definition),
        sources,
        createdBy: actorId(request),
      });
      await recordAudit(
        request,
        'biomarker.create',
        record._id.toString(),
        { key, revision: record.revision },
        'MeasurementRevision',
      );
      response.status(201).json({ data: measurementPayload(record) });
    } catch (error) {
      next(error);
    }
  });
  router.patch(
    '/biomarkers/:key/:revision',
    owners,
    async (request: AuthenticatedRequest, response, next) => {
      try {
        if (
          rejectsUnknownBodyFields(request, response, [
            'displayName',
            'canonicalUnit',
            'definition',
            'sources',
            'status',
          ])
        )
          return;
        const key = param(request, 'key');
        const revision = parseVersion(param(request, 'revision'));
        const body = bodyRecord(request);
        if (!validMeasurementKey(key) || !revision || !body) {
          sendFailure(
            response,
            422,
            'INVALID_REQUEST',
            'A valid biomarker revision and update body are required.',
          );
          return;
        }
        const record = await MeasurementRevisionModel.findOne({ key, revision });
        if (!record) {
          sendFailure(response, 404, 'NOT_FOUND', 'Biomarker revision not found.');
          return;
        }
        if (record.status !== 'draft') {
          sendFailure(
            response,
            409,
            'BIOMARKER_IMMUTABLE',
            'Verified and retired revisions are immutable; create a new revision.',
          );
          return;
        }
        if (body.status !== undefined && body.status !== 'draft') {
          sendFailure(
            response,
            422,
            'INVALID_STATUS',
            'Use the dedicated verify or retire transition endpoint.',
          );
          return;
        }
        if (typeof body.displayName === 'string') record.displayName = body.displayName.trim();
        if (typeof body.canonicalUnit === 'string') record.canonicalUnit = body.canonicalUnit;
        if (isRecord(body.definition)) {
          record.definition = body.definition;
          record.definitionHash = stableMeasurementHash(body.definition);
        }
        if (Array.isArray(body.sources)) record.sources = body.sources;
        await record.save();
        await recordAudit(
          request,
          'biomarker.update',
          record._id.toString(),
          { key, revision, status: record.status },
          'MeasurementRevision',
        );
        response.json({ data: measurementPayload(record) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/biomarkers/:key/:revision/verify',
    medicalReviewers,
    async (request: AuthenticatedRequest, response, next) => {
      try {
        if (rejectsUnknownBodyFields(request, response, [])) return;
        const key = param(request, 'key');
        const revision = parseVersion(param(request, 'revision'));
        if (!validMeasurementKey(key) || !revision) {
          sendFailure(response, 422, 'INVALID_REQUEST', 'A valid biomarker revision is required.');
          return;
        }
        const record = await MeasurementRevisionModel.findOne({ key, revision });
        if (!record) {
          sendFailure(response, 404, 'NOT_FOUND', 'Biomarker revision not found.');
          return;
        }
        if (record.status !== 'draft') {
          sendFailure(
            response,
            409,
            'BIOMARKER_IMMUTABLE',
            'Only draft biomarker revisions can be verified.',
          );
          return;
        }
        if (record.sources.length === 0) {
          sendFailure(
            response,
            422,
            'SOURCE_REQUIRED',
            'A biomarker needs at least one source before verification.',
          );
          return;
        }
        const sourceIssue = measurementSourcesIssue(record.sources);
        if (sourceIssue) {
          sendFailure(response, 422, 'SOURCE_UNRESOLVED', sourceIssue);
          return;
        }
        const structural = validateMeasurementDefinitionStructure(record.definition);
        if (!structural.valid) {
          sendFailure(
            response,
            422,
            'MEASUREMENT_SCHEMA_INVALID',
            'The canonical measurement definition does not satisfy measurement-definition.v1.',
            { findings: structural.findings.slice(0, 20) },
          );
          return;
        }
        const definitionSources = Array.isArray(record.definition.sources)
          ? record.definition.sources
          : [];
        if (!stableMeasurementEqual(record.sources, definitionSources)) {
          sendFailure(
            response,
            422,
            'MEASUREMENT_SOURCE_DIVERGENCE',
            'The persistence source snapshot must exactly match canonical definition.sources.',
          );
          return;
        }
        const envelopeIssue = measurementEnvelopeConsistencyIssue({
          key: record.key,
          revision: record.revision,
          displayName: record.displayName,
          kind: record.kind,
          canonicalUnit: record.canonicalUnit,
          definition: record.definition,
          sources: record.sources,
        });
        if (envelopeIssue) {
          sendFailure(response, 422, 'MEASUREMENT_ENVELOPE_MISMATCH', envelopeIssue);
          return;
        }
        const governance = isRecord(record.definition.governance)
          ? record.definition.governance
          : undefined;
        if (!['draft', 'in-review'].includes(String(record.definition.status))) {
          sendFailure(
            response,
            422,
            'MEASUREMENT_REVIEW_STATE_INVALID',
            'A medical reviewer may approve only a canonical draft or in-review definition.',
          );
          return;
        }
        const publishBlockers = Array.isArray(governance?.publishBlockers)
          ? governance.publishBlockers
          : [];
        if (publishBlockers.length > 0) {
          sendFailure(
            response,
            422,
            'MEASUREMENT_PUBLISH_BLOCKED',
            'Measurement verification is blocked until its declared publish blockers are resolved.',
            { blockerCount: publishBlockers.length },
          );
          return;
        }
        const verifiedAt = new Date();
        const expiryIssue = measurementEvidenceExpiryIssue(record.definition, verifiedAt);
        if (expiryIssue) {
          sendFailure(response, 422, 'MEASUREMENT_REVIEW_EXPIRED', expiryIssue);
          return;
        }
        const definitionIssue = nonDerivedMeasurementSemanticEligibilityIssue(
          record.definition,
          definitionSources,
        );
        if (definitionIssue) {
          sendFailure(response, 422, definitionIssue.code, definitionIssue.message);
          return;
        }
        const currentDefinitionHash = stableMeasurementHash(record.definition);
        if (record.definitionHash !== currentDefinitionHash) {
          sendFailure(
            response,
            409,
            'MEASUREMENT_DEFINITION_HASH_MISMATCH',
            'The stored definition hash no longer matches the canonical draft; save a reviewed revision before verification.',
          );
          return;
        }
        const reviewerObjectId = actorId(request);
        const reviewerId = request.admin?.id;
        if (!reviewerObjectId || !reviewerId) {
          sendFailure(
            response,
            403,
            'REVIEWER_IDENTITY_INVALID',
            'A trusted medical-reviewer identity is required for verification.',
          );
          return;
        }
        const reviewedAt = verifiedAt.toISOString();
        const approvedDefinition: JsonRecord = {
          ...record.definition,
          status: 'approved',
          governance: {
            ...governance,
            reviewStatus: 'approved',
            reviewerId,
            reviewedAt,
            publishBlockers: [],
          },
        };
        const approvedStructural = validateMeasurementDefinitionStructure(approvedDefinition);
        if (!approvedStructural.valid) {
          sendFailure(
            response,
            422,
            'MEASUREMENT_APPROVAL_INVALID',
            'The trusted approval transition did not produce a valid canonical definition.',
            { findings: approvedStructural.findings.slice(0, 20) },
          );
          return;
        }
        const definitionHash = stableMeasurementHash(approvedDefinition);
        const reviewHash = measurementReviewHash({
          definitionHash,
          sources: definitionSources,
          reviewerId,
          reviewedAt,
        });
        if (
          !isApprovedMeasurementEnvelope(
            {
              key: record.key,
              revision: record.revision,
              status: 'verified',
              displayName: record.displayName,
              kind: record.kind,
              canonicalUnit: record.canonicalUnit,
              definition: approvedDefinition,
              definitionHash,
              sources: record.sources,
              reviewedBy: reviewerObjectId,
              verifiedAt,
              reviewHash,
            },
            verifiedAt,
          )
        ) {
          sendFailure(
            response,
            422,
            'MEASUREMENT_APPROVAL_INVALID',
            'The trusted approval transition did not produce a publish-eligible measurement envelope.',
          );
          return;
        }
        record.status = 'verified';
        record.definition = approvedDefinition;
        record.definitionHash = definitionHash;
        record.reviewedBy = reviewerObjectId;
        record.verifiedAt = verifiedAt;
        record.reviewHash = reviewHash;
        await record.save();
        await recordAudit(
          request,
          'biomarker.verify',
          record._id.toString(),
          { key, revision, reviewedBy: request.admin?.id, reviewHash: record.reviewHash },
          'MeasurementRevision',
        );
        response.json({ data: measurementPayload(record) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/biomarkers/:key/:revision/retire',
    owners,
    async (request: AuthenticatedRequest, response, next) => {
      try {
        if (rejectsUnknownBodyFields(request, response, [])) return;
        const key = param(request, 'key');
        const revision = parseVersion(param(request, 'revision'));
        if (!validMeasurementKey(key) || !revision) {
          sendFailure(response, 422, 'INVALID_REQUEST', 'A valid biomarker revision is required.');
          return;
        }
        const record = await MeasurementRevisionModel.findOne({ key, revision });
        if (!record) {
          sendFailure(response, 404, 'NOT_FOUND', 'Biomarker revision not found.');
          return;
        }
        if (record.status !== 'verified') {
          sendFailure(
            response,
            409,
            'BIOMARKER_STATE',
            'Only verified biomarker revisions can be retired.',
          );
          return;
        }
        record.status = 'retired';
        record.retiredAt = new Date();
        await record.save();
        await recordAudit(
          request,
          'biomarker.retire',
          record._id.toString(),
          { key, revision },
          'MeasurementRevision',
        );
        response.json({ data: measurementPayload(record) });
      } catch (error) {
        next(error);
      }
    },
  );
  return router;
}
