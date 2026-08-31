import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

import { Router, type Request, type Response } from 'express';

import { OperationalMetrics } from '../analytics/metrics';
import { parseUserAgent, primaryLocale } from '../analytics/ua';
import {
  ANALYTICS_EVENT_TYPES,
  analyticsEventIdEvidence,
  AnalyticsEventModel,
  type AnalyticsEventType,
} from '../persistence/models/analytics-event';
import { AnonymousVisitorModel } from '../persistence/models/anonymous-visitor';
import { AnalyticsAttributionClaimModel } from '../persistence/models/analytics-attribution-claim';
import { CalculatorModel } from '../persistence/models/calculator';
import { CalculatorVersionModel } from '../persistence/models/calculator-version';
import { MeasurementRevisionModel } from '../persistence/models/measurement-revision';

type JsonRecord = Record<string, unknown>;

export interface AnalyticsEventInput {
  readonly eventId: string;
  readonly type: AnalyticsEventType;
  readonly occurredAt?: string;
  readonly visitorId?: string;
  readonly sessionId: string;
  readonly props?: JsonRecord;
}

export interface AnalyticsEventStore {
  readonly saveMany: (events: readonly JsonRecord[]) => Promise<number | void>;
}

export interface AnalyticsAttributionStore {
  /**
   * Returns sessions that already retained a privacy-minimized attribution.
   * Raw referrer and UTM values never participate in this lookup.
   */
  readonly claimSessions: (
    sessionIdHashes: readonly string[],
    effectiveNow: Date,
    expiresAt: Date,
  ) => Promise<ReadonlySet<string>>;
}

export interface AnalyticsVisitorStore {
  readonly touchMany: (
    visitors: readonly {
      readonly visitorIdHash: string;
      readonly firstSeenAt: Date;
      readonly lastSeenAt: Date;
      readonly expiresAt: Date;
      readonly consentVersion: string;
    }[],
  ) => Promise<void>;
}

export interface AnalyticsSearchVocabulary {
  /** Returns a verified canonical identifier or the fixed non-identifying bucket. */
  readonly canonicalize: (query: string) => Promise<string>;
  readonly isPublishedCalculator: (slug: string) => Promise<boolean>;
  readonly isVerifiedMeasurement: (key: string) => Promise<boolean>;
  readonly isValidStep: (slug: string, step: string, index?: number) => Promise<boolean>;
  readonly isValidParameterUnit: (
    slug: string,
    parameterKey: string,
    unit: string,
  ) => Promise<boolean>;
}

export function createMongoAnalyticsSearchVocabulary(
  options: {
    readonly ttlMs?: number;
    readonly maximumEntries?: number;
  } = {},
): AnalyticsSearchVocabulary {
  const ttlMs = options.ttlMs ?? 30_000;
  const maximumEntries = options.maximumEntries ?? 10_000;
  let cache:
    | {
        readonly expiresAt: number;
        readonly calculators: ReadonlySet<string>;
        readonly measurements: ReadonlySet<string>;
        readonly steps: ReadonlyMap<string, ReadonlyMap<string, number>>;
        readonly parameterUnits: ReadonlyMap<string, ReadonlyMap<string, ReadonlySet<string>>>;
      }
    | undefined;
  let loading: Promise<NonNullable<typeof cache>> | undefined;

  async function vocabulary(): Promise<NonNullable<typeof cache>> {
    const now = Date.now();
    if (cache && cache.expiresAt > now) return cache;
    loading ??= (async () => {
      const [calculators, measurements] = await Promise.all([
        CalculatorModel.find({ status: 'published' })
          .select('slug currentVersionId')
          .limit(maximumEntries)
          .lean(),
        MeasurementRevisionModel.find({ status: 'verified' })
          .select('key')
          .limit(maximumEntries)
          .lean(),
      ]);
      const versions = await CalculatorVersionModel.find({
        _id: { $in: calculators.flatMap((item) => item.currentVersionId ?? []) },
        status: 'published',
      })
        .select('_id payload.parameters payload.uiConfig.steps')
        .limit(maximumEntries)
        .lean();
      const versionById = new Map(versions.map((version) => [version._id.toString(), version]));
      const steps = new Map<string, ReadonlyMap<string, number>>();
      const parameterUnits = new Map<string, ReadonlyMap<string, ReadonlySet<string>>>();
      for (const calculator of calculators) {
        const version = calculator.currentVersionId
          ? versionById.get(calculator.currentVersionId.toString())
          : undefined;
        const payload = version?.payload as JsonRecord | undefined;
        const uiConfig = payload?.uiConfig as JsonRecord | undefined;
        const rawSteps = Array.isArray(uiConfig?.steps) ? uiConfig.steps : [];
        steps.set(
          calculator.slug,
          new Map(
            rawSteps.flatMap((rawStep, index) => {
              const step = isRecord(rawStep) ? safeIdentifier(rawStep.key, 100) : undefined;
              return step ? [[step, index] as const] : [];
            }),
          ),
        );
        const rawParameters = Array.isArray(payload?.parameters) ? payload.parameters : [];
        parameterUnits.set(
          calculator.slug,
          new Map(
            rawParameters.flatMap((rawParameter) => {
              if (!isRecord(rawParameter)) return [];
              const key = safeIdentifier(rawParameter.key, 100);
              const rawUnit = isRecord(rawParameter.unit) ? rawParameter.unit : undefined;
              const canonical = safeUnit(rawUnit?.canonical);
              const allowed = Array.isArray(rawUnit?.allowed)
                ? rawUnit.allowed.flatMap((choice) => {
                    const code = isRecord(choice) ? safeUnit(choice.code) : undefined;
                    return code ? [code] : [];
                  })
                : [];
              const units = new Set([...(canonical ? [canonical] : []), ...allowed]);
              return key && units.size > 0 ? [[key, units] as const] : [];
            }),
          ),
        );
      }
      return {
        expiresAt: Date.now() + ttlMs,
        calculators: new Set(calculators.map((item) => item.slug)),
        measurements: new Set(measurements.map((item) => item.key)),
        steps,
        parameterUnits,
      };
    })().finally(() => {
      loading = undefined;
    });
    cache = await loading;
    return cache;
  }

  return {
    canonicalize: async (query) => {
      const candidate = query.trim().toLowerCase();
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate) || candidate.length > 100) {
        return '[other]';
      }
      const known = await vocabulary();
      return known.calculators.has(candidate) || known.measurements.has(candidate)
        ? candidate
        : '[other]';
    },
    isPublishedCalculator: async (slug) => (await vocabulary()).calculators.has(slug),
    isVerifiedMeasurement: async (key) => (await vocabulary()).measurements.has(key),
    isValidStep: async (slug, step, index) => {
      const authoredIndex = (await vocabulary()).steps.get(slug)?.get(step);
      return authoredIndex !== undefined && (index === undefined || index === authoredIndex);
    },
    isValidParameterUnit: async (slug, parameterKey, unit) =>
      (await vocabulary()).parameterUnits.get(slug)?.get(parameterKey)?.has(unit) === true,
  };
}

const ALLOWED_EVENT_FIELDS = [
  'eventId',
  'type',
  'occurredAt',
  'visitorId',
  'sessionId',
  'props',
] as const;
const ALLOWED_PROP_FIELDS = [
  'path',
  'calculatorSlug',
  'step',
  'stepIndex',
  'query',
  'referrerHost',
  'utmSource',
  'utmMedium',
  'utmCampaign',
  'zeroResults',
  'unit',
  'parameterKey',
  'action',
] as const;
const ATTRIBUTION_PROP_FIELDS = ['referrerHost', 'utmSource', 'utmMedium', 'utmCampaign'] as const;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function boundedString(value: unknown, max = 200): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= max ? value : undefined;
}

function safeOpaqueIdentity(value: unknown): string | undefined {
  const text = boundedString(value, 200);
  return text && text.length >= 16 && /^[A-Za-z0-9_-]+$/.test(text) ? text : undefined;
}

function safeIdentifier(value: unknown, max = 100): string | undefined {
  const text = boundedString(value, max);
  return text && /^[A-Za-z0-9][A-Za-z0-9._:~-]*$/.test(text) ? text : undefined;
}

function safeSlug(value: unknown): string | undefined {
  const text = boundedString(value, 100);
  return text && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(text) ? text : undefined;
}

function safeUnit(value: unknown): string | undefined {
  const text = boundedString(value, 30);
  return text && /^[A-Za-z0-9µμ%/^.\s-]+$/u.test(text) ? text : undefined;
}

function hash(value: string, secret: string, domain: 'visitor' | 'session'): string {
  return createHmac('sha256', secret).update(`${domain}:${value}`).digest('hex');
}

function failure(
  response: Response,
  status: number,
  code: string,
  message: string,
  metrics?: OperationalMetrics,
  rejected = 1,
): void {
  metrics?.observeEvents('rejected', rejected);
  response.status(status).json({ error: { code, message } });
}

function safeSearchQuery(value: unknown): string | undefined {
  const normalized = boundedString(value, 80)?.trim().replace(/\s+/g, ' ');
  return normalized || undefined;
}

function safeAttribution(value: unknown): string | undefined {
  const normalized = safeIdentifier(value, 100);
  if (!normalized || /[@]|\b\+?\d[\d\s()-]{7,}\b/.test(normalized)) return undefined;
  return normalized;
}

function safeHost(value: unknown): string | undefined {
  const host = boundedString(value, 253)?.toLowerCase();
  if (!host) return undefined;
  const unbracketed = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
  let urlNormalized = unbracketed;
  try {
    urlNormalized = new URL(`http://${host}`).hostname.replace(/^\[|\]$/g, '');
  } catch {
    return undefined;
  }
  if (isIP(unbracketed) > 0 || isIP(urlNormalized) > 0 || /^\d+$/.test(host)) return undefined;
  return /^(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)*[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/.test(host)
    ? host
    : undefined;
}

function safePath(value: unknown): string | undefined {
  const path = boundedString(value, 300);
  if (
    !path?.startsWith('/') ||
    path.includes('?') ||
    path.includes('#') ||
    /@|\b\d{8,}\b/.test(path)
  )
    return undefined;
  const normalized = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  const redacted = normalized.replace(/^(\/(?:api\/v1\/)?results\/)[^/]+$/i, '$1[capability]');
  return /^(?:\/$|\/c\/[a-z0-9]+(?:-[a-z0-9]+)*$|\/results\/\[capability\]$|\/api\/v1\/results\/\[capability\]$|\/biomarkers(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?$)/.test(
    redacted,
  )
    ? redacted
    : undefined;
}

function safeProps(props: JsonRecord | undefined): JsonRecord | undefined {
  if (!props) return {};
  if (Object.keys(props).some((key) => !ALLOWED_PROP_FIELDS.includes(key as never))) {
    return undefined;
  }
  const path = safePath(props.path);
  const calculatorSlug = safeSlug(props.calculatorSlug);
  const step = safeIdentifier(props.step, 100);
  const stepIndex =
    Number.isSafeInteger(props.stepIndex) &&
    Number(props.stepIndex) >= 0 &&
    Number(props.stepIndex) <= 100
      ? Number(props.stepIndex)
      : undefined;
  const query = safeSearchQuery(props.query);
  const referrerHost = safeHost(props.referrerHost);
  const utmSource = safeAttribution(props.utmSource);
  const utmMedium = safeAttribution(props.utmMedium);
  const utmCampaign = safeAttribution(props.utmCampaign);
  const unit = safeUnit(props.unit);
  const parameterKey = safeIdentifier(props.parameterKey, 100);
  const action = ['open', 'copy', 'retake'].includes(String(props.action))
    ? String(props.action)
    : undefined;
  const validations: readonly [string, unknown][] = [
    ['path', path],
    ['calculatorSlug', calculatorSlug],
    ['step', step],
    ['stepIndex', stepIndex],
    ['query', query],
    ['referrerHost', referrerHost],
    ['utmSource', utmSource],
    ['utmMedium', utmMedium],
    ['utmCampaign', utmCampaign],
    ['unit', unit],
    ['parameterKey', parameterKey],
    ['action', action],
  ];
  if (validations.some(([key, normalized]) => key in props && normalized === undefined)) {
    return undefined;
  }
  return {
    ...(path ? { path } : {}),
    ...(calculatorSlug ? { calculatorSlug } : {}),
    ...(step ? { step } : {}),
    ...(stepIndex !== undefined ? { stepIndex } : {}),
    ...(query ? { query } : {}),
    ...(referrerHost ? { referrerHost } : {}),
    ...(utmSource ? { utmSource } : {}),
    ...(utmMedium ? { utmMedium } : {}),
    ...(utmCampaign ? { utmCampaign } : {}),
    ...(typeof props.zeroResults === 'boolean' ? { zeroResults: props.zeroResults } : {}),
    ...(unit ? { unit } : {}),
    ...(parameterKey ? { parameterKey } : {}),
    ...(action ? { action } : {}),
  };
}

const SEMANTIC_PROPS: Record<
  AnalyticsEventType,
  { readonly required: readonly string[]; readonly allowed: readonly string[] }
> = {
  page_view: {
    required: ['path'],
    allowed: ['path', 'calculatorSlug', 'referrerHost', 'utmSource', 'utmMedium', 'utmCampaign'],
  },
  calc_start: {
    required: ['calculatorSlug'],
    allowed: ['calculatorSlug', 'path', 'referrerHost', 'utmSource', 'utmMedium', 'utmCampaign'],
  },
  step_view: {
    required: ['calculatorSlug', 'step', 'stepIndex'],
    allowed: ['calculatorSlug', 'step', 'stepIndex'],
  },
  assess_submit: { required: ['calculatorSlug'], allowed: ['calculatorSlug'] },
  result_view: { required: ['calculatorSlug'], allowed: ['calculatorSlug', 'path'] },
  share: { required: ['calculatorSlug', 'action'], allowed: ['calculatorSlug', 'action'] },
  search: { required: ['query', 'zeroResults'], allowed: ['query', 'zeroResults', 'path'] },
  unit_switch: {
    required: ['calculatorSlug', 'parameterKey', 'unit'],
    allowed: ['calculatorSlug', 'parameterKey', 'unit'],
  },
  share_open: {
    required: ['calculatorSlug', 'path', 'action'],
    allowed: ['calculatorSlug', 'path', 'action'],
  },
  retake: { required: ['calculatorSlug', 'action'], allowed: ['calculatorSlug', 'action'] },
  assess_error: { required: ['calculatorSlug'], allowed: ['calculatorSlug', 'step'] },
};

function semanticPropsValid(type: AnalyticsEventType, props: JsonRecord): boolean {
  const rule = SEMANTIC_PROPS[type];
  const keys = Object.keys(props);
  if (rule.required.some((key) => !(key in props))) return false;
  if (keys.some((key) => !rule.allowed.includes(key))) return false;
  if (type === 'share' && props.action !== 'copy') return false;
  if (type === 'share_open' && props.action !== 'open') return false;
  if (type === 'retake' && props.action !== 'retake') return false;
  return true;
}

function isDuplicateOnlyBulkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as {
    code?: unknown;
    writeErrors?: readonly { code?: unknown }[];
  };
  return (
    candidate.code === 11_000 ||
    (Array.isArray(candidate.writeErrors) &&
      candidate.writeErrors.length > 0 &&
      candidate.writeErrors.every((item) => item.code === 11_000))
  );
}

export function createMongoAnalyticsEventStore(): AnalyticsEventStore {
  return {
    saveMany: async (events) => {
      if (events.length === 0) return 0;
      try {
        const result = await AnalyticsEventModel.bulkWrite(
          events.map((event) => ({
            updateOne: {
              filter: { eventId: event.eventId },
              update: { $setOnInsert: event },
              upsert: true,
            },
          })),
          { ordered: false },
        );
        return result.upsertedCount;
      } catch (error) {
        if (!isDuplicateOnlyBulkError(error)) throw error;
        const result = (error as { result?: { upsertedCount?: number } }).result;
        return result?.upsertedCount ?? 0;
      }
    },
  };
}

export function createMongoAnalyticsAttributionStore(): AnalyticsAttributionStore {
  return {
    claimSessions: async (sessionIdHashes, effectiveNow, expiresAt) => {
      const uniqueHashes = [...new Set(sessionIdHashes)];
      if (uniqueHashes.length === 0) return new Set();
      // Seed claims for retained pre-marker events during a rolling upgrade.
      // This bounded query uses only HMAC evidence and prevents a historical
      // first attribution from being accepted again after deployment.
      const retainedSessions = new Set(
        await AnalyticsEventModel.distinct('sessionIdHash', {
          sessionIdHash: { $in: uniqueHashes },
          expiresAt: { $gt: effectiveNow },
          $or: ATTRIBUTION_PROP_FIELDS.map((field) => ({ [field]: { $exists: true } })),
        }),
      );
      await Promise.all(
        [...retainedSessions].map(async (sessionIdHash) => {
          try {
            await AnalyticsAttributionClaimModel.updateOne(
              { _id: sessionIdHash },
              {
                $setOnInsert: { claimedAt: effectiveNow },
                $max: { expiresAt },
              },
              { upsert: true },
            );
          } catch (error) {
            if (!isDuplicateOnlyBulkError(error)) throw error;
            await AnalyticsAttributionClaimModel.updateOne(
              { _id: sessionIdHash },
              { $max: { expiresAt } },
            );
          }
        }),
      );
      const claimed = await Promise.all(
        uniqueHashes
          .filter((sessionIdHash) => !retainedSessions.has(sessionIdHash))
          .map(async (sessionIdHash) => {
            try {
              const result = await AnalyticsAttributionClaimModel.updateOne(
                { _id: sessionIdHash, expiresAt: { $lte: effectiveNow } },
                { $set: { claimedAt: effectiveNow, expiresAt } },
                { upsert: true },
              );
              return result.upsertedCount === 1 || result.matchedCount === 1
                ? sessionIdHash
                : undefined;
            } catch (error) {
              if (!isDuplicateOnlyBulkError(error)) throw error;
              // An unexpired claim (including a concurrent winner) owns the
              // attribution. Extend its logical lifetime to cover this retained
              // event without changing ownership.
              await AnalyticsAttributionClaimModel.updateOne(
                { _id: sessionIdHash, expiresAt: { $gt: effectiveNow } },
                { $max: { expiresAt } },
              );
              return undefined;
            }
          }),
      );
      return new Set(claimed.filter((value): value is string => value !== undefined));
    },
  };
}

export function createMongoAnalyticsVisitorStore(): AnalyticsVisitorStore {
  return {
    touchMany: async (visitors) => {
      if (visitors.length === 0) return;
      const operations = visitors.map((visitor) => ({
        updateOne: {
          filter: { visitorIdHash: visitor.visitorIdHash },
          update: {
            $setOnInsert: {
              visitorIdHash: visitor.visitorIdHash,
              consentVersion: visitor.consentVersion,
            },
            $min: { firstSeenAt: visitor.firstSeenAt },
            $max: { lastSeenAt: visitor.lastSeenAt, expiresAt: visitor.expiresAt },
          },
          upsert: true,
        },
      }));
      try {
        await AnonymousVisitorModel.bulkWrite(operations, { ordered: false });
      } catch (error) {
        if (!isDuplicateOnlyBulkError(error)) throw error;
        // Another instance may have inserted the same pseudonymous visitor
        // between the upsert match and insert. Reconcile every timestamp using
        // updates only; the winning insert already established the identity.
        await AnonymousVisitorModel.bulkWrite(
          visitors.map((visitor) => ({
            updateOne: {
              filter: { visitorIdHash: visitor.visitorIdHash },
              update: {
                $min: { firstSeenAt: visitor.firstSeenAt },
                $max: { lastSeenAt: visitor.lastSeenAt, expiresAt: visitor.expiresAt },
              },
              upsert: false,
            },
          })),
          { ordered: false },
        );
      }
    },
  };
}

export interface AnalyticsRouterOptions {
  readonly hashSecret?: string;
  readonly store?: AnalyticsEventStore;
  readonly attributionStore?: AnalyticsAttributionStore;
  readonly visitorStore?: AnalyticsVisitorStore;
  readonly searchVocabulary?: AnalyticsSearchVocabulary;
  readonly now?: () => Date;
  readonly retentionDays?: number;
  readonly identityKeyVersion?: string;
  readonly visitorPersistence?: {
    readonly enabled: boolean;
    readonly retentionDays?: number;
    readonly consentVersion?: string;
  };
  readonly metrics?: OperationalMetrics;
}

export function pruneAnalyticsRateLimitState(
  hits: Map<string, { started: number; count: number }>,
  now: number,
  hardLimit = 10_000,
  targetSize = 5_000,
): void {
  for (const [key, value] of hits) {
    if (now - value.started > 60_000) hits.delete(key);
  }
  if (hits.size < hardLimit) return;
  for (const key of hits.keys()) {
    hits.delete(key);
    if (hits.size <= targetSize) break;
  }
}

export function createAnalyticsRouter(options: AnalyticsRouterOptions = {}): Router {
  const router = Router();
  const store = options.store ?? createMongoAnalyticsEventStore();
  const attributionStore = options.attributionStore ?? createMongoAnalyticsAttributionStore();
  const visitorStore = options.visitorStore ?? createMongoAnalyticsVisitorStore();
  const searchVocabulary = options.searchVocabulary ?? createMongoAnalyticsSearchVocabulary();
  const now = options.now ?? (() => new Date());
  const hits = new Map<string, { started: number; count: number }>();
  router.post('/', async (request: Request, response: Response, next) => {
    try {
      if (!options.hashSecret) {
        failure(
          response,
          503,
          'ANALYTICS_NOT_CONFIGURED',
          'Analytics identity hashing is not configured.',
          options.metrics,
        );
        return;
      }
      const address = request.ip || request.socket.remoteAddress || 'unknown';
      const timestamp = Date.now();
      pruneAnalyticsRateLimitState(hits, timestamp);
      const current = hits.get(address);
      const hit =
        !current || timestamp - current.started > 60_000
          ? { started: timestamp, count: 1 }
          : { ...current, count: current.count + 1 };
      hits.set(address, hit);
      if (hit.count > 60) {
        response.setHeader(
          'Retry-After',
          String(Math.max(1, Math.ceil((hit.started + 60_000 - timestamp) / 1_000))),
        );
        failure(
          response,
          429,
          'RATE_LIMITED',
          'Too many event batches; retry later.',
          options.metrics,
        );
        return;
      }
      if (!isRecord(request.body) || Object.keys(request.body).some((key) => key !== 'events')) {
        failure(
          response,
          422,
          'INVALID_REQUEST',
          'Request body must contain only an events array.',
          options.metrics,
        );
        return;
      }
      const rawEvents = Array.isArray(request.body.events) ? request.body.events : [];
      if (rawEvents.length < 1 || rawEvents.length > 50) {
        failure(
          response,
          422,
          'INVALID_REQUEST',
          'events must contain between 1 and 50 items.',
          options.metrics,
          Math.max(rawEvents.length, 1),
        );
        return;
      }
      const parsedAgent = parseUserAgent(request.header('user-agent'));
      if (parsedAgent.isBot) {
        options.metrics?.observeEvents('filtered-bot', rawEvents.length);
        response.status(202).json({
          data: { accepted: 0, duplicates: 0, filteredBots: rawEvents.length },
        });
        return;
      }
      const receivedAt = now();
      const expiresAt = new Date(
        receivedAt.getTime() + (options.retentionDays ?? 180) * 86_400_000,
      );
      const events: JsonRecord[] = [];
      const eventFingerprints = new Map<string, string>();
      const visitors = new Map<
        string,
        {
          visitorIdHash: string;
          firstSeenAt: Date;
          lastSeenAt: Date;
          expiresAt: Date;
          consentVersion: string;
        }
      >();
      for (const raw of rawEvents) {
        if (!isRecord(raw)) {
          failure(
            response,
            422,
            'INVALID_EVENT',
            'Each event must be an object.',
            options.metrics,
            rawEvents.length,
          );
          return;
        }
        const unknown = Object.keys(raw).filter(
          (key) => !ALLOWED_EVENT_FIELDS.includes(key as never),
        );
        const eventId = safeIdentifier(raw.eventId, 100);
        const type = boundedString(raw.type, 40);
        const sessionId = safeOpaqueIdentity(raw.sessionId);
        const props = isRecord(raw.props)
          ? safeProps(raw.props)
          : raw.props === undefined
            ? {}
            : undefined;
        if (
          unknown.length > 0 ||
          props === undefined ||
          !eventId ||
          !type ||
          !ANALYTICS_EVENT_TYPES.includes(type as AnalyticsEventType) ||
          !sessionId
        ) {
          failure(
            response,
            422,
            'INVALID_EVENT',
            'Event fields or props are unsupported or invalid.',
            options.metrics,
            rawEvents.length,
          );
          return;
        }
        if (!semanticPropsValid(type as AnalyticsEventType, props)) {
          failure(
            response,
            422,
            'INVALID_EVENT',
            'Event props do not match the selected event type.',
            options.metrics,
            rawEvents.length,
          );
          return;
        }
        if (type === 'search') {
          // The raw browser query is used only for this authoritative lookup.
          // It never crosses into the event fingerprint, MongoDB, rollups, or
          // dashboard output unless it exactly matches a published identifier.
          props.query = await searchVocabulary.canonicalize(String(props.query));
        }
        if (
          typeof props.calculatorSlug === 'string' &&
          !(await searchVocabulary.isPublishedCalculator(props.calculatorSlug))
        ) {
          failure(
            response,
            422,
            'INVALID_EVENT',
            'Event fields or props are unsupported or invalid.',
            options.metrics,
            rawEvents.length,
          );
          return;
        }
        if (
          (type === 'step_view' || (type === 'assess_error' && props.step !== undefined)) &&
          !(await searchVocabulary.isValidStep(
            String(props.calculatorSlug),
            String(props.step),
            type === 'step_view' ? Number(props.stepIndex) : undefined,
          ))
        ) {
          failure(
            response,
            422,
            'INVALID_EVENT',
            'Event fields or props are unsupported or invalid.',
            options.metrics,
            rawEvents.length,
          );
          return;
        }
        if (
          type === 'unit_switch' &&
          !(await searchVocabulary.isValidParameterUnit(
            String(props.calculatorSlug),
            String(props.parameterKey),
            String(props.unit),
          ))
        ) {
          failure(
            response,
            422,
            'INVALID_EVENT',
            'Event fields or props are unsupported or invalid.',
            options.metrics,
            rawEvents.length,
          );
          return;
        }
        const calculatorPath =
          typeof props.path === 'string' ? props.path.match(/^\/c\/([^/]+)$/)?.[1] : undefined;
        const scopedCalculatorPath =
          typeof props.calculatorSlug === 'string' ? `/c/${props.calculatorSlug}` : undefined;
        if (
          (calculatorPath &&
            (props.calculatorSlug !== calculatorPath ||
              !(await searchVocabulary.isPublishedCalculator(calculatorPath)))) ||
          (type === 'page_view' &&
            scopedCalculatorPath !== undefined &&
            props.path !== scopedCalculatorPath) ||
          (type === 'calc_start' && props.path !== undefined && props.path !== scopedCalculatorPath)
        ) {
          failure(
            response,
            422,
            'INVALID_EVENT',
            'Event fields or props are unsupported or invalid.',
            options.metrics,
            rawEvents.length,
          );
          return;
        }
        const measurementPath =
          typeof props.path === 'string'
            ? props.path.match(/^\/biomarkers\/([^/]+)$/)?.[1]
            : undefined;
        if (measurementPath && !(await searchVocabulary.isVerifiedMeasurement(measurementPath))) {
          failure(
            response,
            422,
            'INVALID_EVENT',
            'Event fields or props are unsupported or invalid.',
            options.metrics,
            rawEvents.length,
          );
          return;
        }
        const occurredAt = raw.occurredAt ? new Date(String(raw.occurredAt)) : receivedAt;
        if (
          Number.isNaN(occurredAt.getTime()) ||
          Math.abs(occurredAt.getTime() - receivedAt.getTime()) > 86_400_000
        ) {
          failure(
            response,
            422,
            'INVALID_EVENT',
            'occurredAt must be within one day of server time.',
            options.metrics,
            rawEvents.length,
          );
          return;
        }
        const visitorId =
          raw.visitorId === undefined ? undefined : safeOpaqueIdentity(raw.visitorId);
        if (raw.visitorId !== undefined && !visitorId) {
          failure(
            response,
            422,
            'INVALID_EVENT',
            'visitorId must be an opaque 16-200 character identifier.',
            options.metrics,
            rawEvents.length,
          );
          return;
        }
        const visitorIdHash =
          options.visitorPersistence?.enabled && visitorId
            ? hash(visitorId, options.hashSecret, 'visitor')
            : undefined;
        if (visitorIdHash) {
          const retentionDays = options.visitorPersistence?.retentionDays;
          const consentVersion = options.visitorPersistence?.consentVersion;
          if (!retentionDays || !consentVersion) {
            failure(
              response,
              503,
              'VISITOR_ANALYTICS_NOT_CONFIGURED',
              'Persistent visitor analytics requires retention and consent configuration.',
              options.metrics,
              rawEvents.length,
            );
            return;
          }
          const prior = visitors.get(visitorIdHash);
          visitors.set(visitorIdHash, {
            visitorIdHash,
            firstSeenAt: prior && prior.firstSeenAt < occurredAt ? prior.firstSeenAt : occurredAt,
            lastSeenAt: prior && prior.lastSeenAt > occurredAt ? prior.lastSeenAt : occurredAt,
            expiresAt:
              prior && prior.expiresAt > new Date(receivedAt.getTime() + retentionDays * 86_400_000)
                ? prior.expiresAt
                : new Date(receivedAt.getTime() + retentionDays * 86_400_000),
            consentVersion,
          });
        }
        const sessionIdHash = hash(sessionId, options.hashSecret, 'session');
        const eventFingerprint = JSON.stringify({
          type,
          occurredAt: occurredAt.toISOString(),
          visitorIdHash,
          sessionIdHash,
          props,
        });
        const priorFingerprint = eventFingerprints.get(eventId);
        if (priorFingerprint !== undefined) {
          if (priorFingerprint !== eventFingerprint) {
            failure(
              response,
              409,
              'EVENT_ID_CONFLICT',
              'An eventId was reused with different event data.',
              options.metrics,
              rawEvents.length,
            );
            return;
          }
          continue;
        }
        eventFingerprints.set(eventId, eventFingerprint);
        events.push({
          eventId: analyticsEventIdEvidence(eventId, options.hashSecret),
          eventIdHashVersion: 'hmac-v1',
          type,
          occurredAt,
          visitorIdHash,
          sessionIdHash,
          identityKeyVersion: options.identityKeyVersion ?? 'v1',
          ...props,
          device: parsedAgent.device,
          browser: parsedAgent.browser,
          os: parsedAgent.os,
          locale: primaryLocale(request.header('accept-language')),
          expiresAt,
        });
      }
      const firstAttributionBySession = new Map<string, JsonRecord>();
      for (const item of events) {
        if (!ATTRIBUTION_PROP_FIELDS.some((field) => item[field] !== undefined)) continue;
        const sessionIdHash = String(item.sessionIdHash);
        if (!firstAttributionBySession.has(sessionIdHash)) {
          firstAttributionBySession.set(sessionIdHash, item);
        }
      }
      const claimedAttributionSessions = await attributionStore.claimSessions(
        [...firstAttributionBySession.keys()],
        receivedAt,
        expiresAt,
      );
      for (const item of events) {
        if (!ATTRIBUTION_PROP_FIELDS.some((field) => item[field] !== undefined)) continue;
        const sessionIdHash = String(item.sessionIdHash);
        if (
          firstAttributionBySession.get(sessionIdHash) !== item ||
          !claimedAttributionSessions.has(sessionIdHash)
        ) {
          for (const field of ATTRIBUTION_PROP_FIELDS) delete item[field];
        }
      }
      await visitorStore.touchMany([...visitors.values()]);
      const saved = await store.saveMany(events);
      const accepted = saved ?? events.length;
      options.metrics?.observeEvents('accepted', accepted);
      response.status(202).json({
        data: {
          accepted,
          // Include exact repeats removed inside this batch as well as events
          // already present in MongoDB.
          duplicates: Math.max(0, rawEvents.length - accepted),
          filteredBots: 0,
        },
      });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
