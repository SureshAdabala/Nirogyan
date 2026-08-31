import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';

import { calculate, ENGINE_SEMANTIC_VERSION } from '@niro/engine';
import { Types } from 'mongoose';

import { createApp } from '../apps/server/src/app';
import { loadEnvironment, loadProjectEnvironment } from '../apps/server/src/config/env';
import { connectDatabase, disconnectDatabase } from '../apps/server/src/db/connection';
import {
  createMongoAssessmentStore,
  createMongoLeadStore,
  createMongoResultSource,
  IdempotencyConflictError,
  type PublishedCalculatorRecord,
} from '../apps/server/src/modules/public';
import { AssessmentModel } from '../apps/server/src/persistence/models/assessment';
import { CalculatorModel } from '../apps/server/src/persistence/models/calculator';
import { CalculatorVersionModel } from '../apps/server/src/persistence/models/calculator-version';
import { ResultModel } from '../apps/server/src/persistence/models/result';
import { LeadModel } from '../apps/server/src/persistence/models/lead';
import { authorizeTemporaryDatabaseWrite } from './integration-write-authorization';

const payload: Record<string, unknown> = {
  calculatorSlug: 'p3-live-fixture',
  name: 'P3 live integration fixture',
  version: 1,
  shortDescription: 'Temporary nonclinical integration fixture.',
  disclaimers: ['For automated integration tests only.'],
  parameters: [
    {
      key: 'value',
      label: 'Value',
      group: 'general',
      inputType: 'number',
      order: 1,
      biomarkerKey: 'synthetic-value',
      unit: { canonical: 'unit' },
      validation: { required: true, min: 0, max: 100 },
    },
  ],
  scoringRules: [
    {
      parameterKey: 'value',
      contexts: [
        {
          when: null,
          bands: [
            { min: null, max: 10, points: 1 },
            { min: 10, points: 2 },
          ],
        },
      ],
    },
  ],
  formulas: [{ key: 'final-score', expression: 'sum(points)' }],
  domains: [{ key: 'overall', label: 'Overall', weight: 1, parameterKeys: ['value'] }],
  resultCategories: {
    scale: { min: 0, max: 2, direction: 'higher-is-worse' },
    bandEdges: 'min-inclusive',
    bands: [
      { label: 'low', max: 2, color: '#00aa00' },
      { label: 'high', min: 2, color: '#aa0000' },
    ],
  },
  uiConfig: {
    theme: { accent: '#0d5cab' },
    steps: [{ key: 'general', title: 'General', parameterGroups: ['general'] }],
    result: {
      layout: [
        'score-gauge',
        'category',
        'key-contributors',
        'domain-breakdown',
        'biomarker-details',
        'recommendations',
      ],
    },
  },
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    server.close((error: Error | undefined) => (error ? reject(error) : resolve())),
  );
}

async function main(args: readonly string[] = process.argv.slice(2)): Promise<void> {
  loadProjectEnvironment();
  const environment = loadEnvironment();
  if (!environment.mongoUri) throw new Error('MONGODB_URI is not configured.');
  authorizeTemporaryDatabaseWrite(environment, args, 'Public API integration');
  await connectDatabase({ environment });

  const suffix = randomUUID();
  const slug = `p3-live-${suffix}`;
  const calculatorId = new Types.ObjectId();
  const leadEmail = `p5-${suffix}@example.invalid`;
  const leadConsentVersion = `p5-integration-${suffix}`;
  let server: Server | undefined;
  try {
    const calculator = await CalculatorModel.create({
      _id: calculatorId,
      slug,
      name: 'P3 live integration fixture',
      status: 'published',
    });
    const version = await CalculatorVersionModel.create({
      calculatorId: calculator._id,
      calculatorSlug: slug,
      version: 1,
      status: 'published',
      engineSemanticVersion: ENGINE_SEMANTIC_VERSION,
      payload: { ...payload, calculatorSlug: slug },
      measurementRevisionIds: [],
      measurementSnapshots: [],
      versionHash: `p3-${suffix}`,
      publishedAt: new Date(),
      immutableAt: new Date(),
    });
    await CalculatorModel.updateOne(
      { _id: calculator._id },
      { $set: { currentVersionId: version._id } },
    );

    const liveCatalog = {
      async listPublished(): Promise<readonly PublishedCalculatorRecord[]> {
        const versions = await CalculatorVersionModel.find({
          calculatorSlug: slug,
          status: 'published',
        })
          .sort({ version: -1 })
          .lean();
        return versions.map((item) => ({
          id: item._id.toString(),
          calculatorSlug: item.calculatorSlug,
          version: item.version,
          payload: item.payload as Record<string, unknown>,
        }));
      },
      async getPublished(requestedSlug: string): Promise<PublishedCalculatorRecord | undefined> {
        const item = await CalculatorVersionModel.findOne({
          calculatorSlug: requestedSlug,
          status: 'published',
        })
          .sort({ version: -1 })
          .lean();
        return item
          ? {
              id: item._id.toString(),
              calculatorSlug: item.calculatorSlug,
              version: item.version,
              payload: item.payload as Record<string, unknown>,
            }
          : undefined;
      },
    };
    const assessmentStore = createMongoAssessmentStore({ retentionDays: 1 });
    const resultSource = createMongoResultSource();
    const app = createApp(
      environment,
      { databaseReady: () => true },
      {
        catalog: liveCatalog,
        assessmentStore,
        result: resultSource,
        rateLimit: { max: 20, windowMs: 60_000 },
        leadCapture: {
          consentVersion: leadConsentVersion,
          store: createMongoLeadStore({ retentionDays: 1 }),
        },
      },
    );
    server = app.listen(0);
    const address = server.address();
    assert(address && typeof address !== 'string', 'Integration server address unavailable.');
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const configResponse = await fetch(`${baseUrl}/api/v1/calculators/${slug}`);
    assert(
      configResponse.status === 200,
      `Live config projection failed (${configResponse.status}).`,
    );
    const configJson = (await configResponse.json()) as { data: Record<string, unknown> };
    const configText = JSON.stringify(configJson.data);
    assert(!configText.includes('scoringRules'), 'Public config exposed scoring rules.');
    assert(!configText.includes('formulas'), 'Public config exposed formulas.');
    assert(!configText.includes('"weight"'), 'Public config exposed domain weights.');
    assert(!configText.includes('"points"'), 'Public config exposed point values.');
    const configTag = configResponse.headers.get('etag');
    assert(configTag, 'Live config did not return an ETag.');
    const config304 = await fetch(`${baseUrl}/api/v1/calculators/${slug}`, {
      headers: { 'If-None-Match': configTag },
    });
    assert(config304.status === 304, `Live config ETag did not revalidate (${config304.status}).`);

    const listResponse = await fetch(`${baseUrl}/api/v1/calculators`);
    assert(listResponse.status === 200, `Live calculator list failed (${listResponse.status}).`);
    const listTag = listResponse.headers.get('etag');
    assert(listTag, 'Live calculator list did not return an ETag.');
    const list304 = await fetch(`${baseUrl}/api/v1/calculators`, {
      headers: { 'If-None-Match': listTag },
    });
    assert(
      list304.status === 304,
      `Live calculator list ETag did not revalidate (${list304.status}).`,
    );

    const idempotencyKey = `p3-${randomUUID()}`;
    const assessUrl = `${baseUrl}/api/v1/calculators/${slug}/assess`;
    const firstResponse = await fetch(assessUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ inputs: { value: 5 } }),
    });
    assert(firstResponse.status === 200, `Live assessment failed (${firstResponse.status}).`);
    const firstJson = (await firstResponse.json()) as { data: Record<string, unknown> };
    const shareToken = firstJson.data.shareToken;
    assert(
      typeof shareToken === 'string' && shareToken.length >= 32,
      'Share token was not issued.',
    );

    const replayResponse = await fetch(assessUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ inputs: { value: 5 } }),
    });
    assert(replayResponse.status === 200, `Idempotent replay failed (${replayResponse.status}).`);
    const replayJson = (await replayResponse.json()) as { data: Record<string, unknown> };
    assert(
      JSON.stringify(replayJson) === JSON.stringify(firstJson),
      'Idempotent replay changed the response.',
    );

    const firstCalculation = calculate(payload, { value: 5 }, { includeTrace: false });
    let durableConflict = false;
    try {
      await assessmentStore.save({
        calculatorSlug: slug,
        versionId: version._id.toString(),
        version: 1,
        inputs: { value: 5 },
        result: firstCalculation,
        idempotencyKey,
      });
    } catch (error) {
      durableConflict = error instanceof IdempotencyConflictError;
    }
    assert(durableConflict, 'Durable idempotency did not reject a duplicate key.');

    const assessment = await AssessmentModel.findOne({ calculatorSlug: slug }).lean();
    const result = await ResultModel.findOne({ calculatorSlug: slug }).lean();
    assert(assessment && result, 'Assessment/result transaction did not commit both documents.');
    assert(
      (await AssessmentModel.countDocuments({ calculatorSlug: slug })) === 1,
      'Idempotency duplicate created a second assessment.',
    );
    assert(
      assessment.calculatorVersionId?.toString() === version._id.toString(),
      'Assessment calculatorVersionId is not the exact executed version.',
    );
    assert(
      result.calculatorVersionId?.toString() === version._id.toString(),
      'Result calculatorVersionId is not the exact executed version.',
    );
    assert(
      result.engineSemanticVersion === ENGINE_SEMANTIC_VERSION,
      'Engine version snapshot mismatch.',
    );
    assert(
      assessment.idempotencyKeyHash && !JSON.stringify(assessment).includes(idempotencyKey),
      'Raw idempotency key was persisted.',
    );

    const secondCalculation = calculate(payload, { value: 5 }, { includeTrace: false });
    assert(
      JSON.stringify(firstCalculation) === JSON.stringify(secondCalculation),
      'Engine result is not reproducible.',
    );
    assert(
      result.projection.score === firstCalculation.score,
      'Persisted score does not match the exact calculation.',
    );

    const resultResponse = await fetch(`${baseUrl}/api/v1/results/${shareToken}`);
    assert(resultResponse.status === 200, `Live share read failed (${resultResponse.status}).`);
    assert(
      resultResponse.headers.get('cache-control') === 'no-store',
      'Share response is cacheable.',
    );
    assert(
      resultResponse.headers.get('x-robots-tag')?.includes('noindex'),
      'Share response is indexable.',
    );
    const resultJson = await resultResponse.json();
    const resultText = JSON.stringify(resultJson);
    const publicResult = resultJson as {
      data: { presentation?: Record<string, unknown> };
    };
    const presentation = publicResult.data.presentation;
    assert(presentation, 'Share response omitted its immutable presentation snapshot.');
    assert(
      presentation.calculatorSlug === slug && presentation.calculatorVersion === 1,
      'Share presentation does not identify the exact calculator version.',
    );
    assert(
      JSON.stringify(presentation.resultLayout) ===
        JSON.stringify([
          'score-gauge',
          'category',
          'key-contributors',
          'domain-breakdown',
          'biomarker-details',
          'recommendations',
        ]),
      'Share presentation did not freeze the configured result layout.',
    );
    assert(
      JSON.stringify(presentation.scoreScale) ===
        JSON.stringify({ min: 0, max: 2, direction: 'higher-is-worse' }),
      'Share presentation did not freeze the safe score scale.',
    );
    assert(
      JSON.stringify(presentation.parameters).includes('synthetic-value') &&
        JSON.stringify(presentation.domains).includes('Overall'),
      'Share presentation omitted safe parameter/domain labels.',
    );
    for (const protectedName of [
      'formulas',
      'scoringRules',
      'points',
      'possiblePoints',
      'weight',
      'trace',
    ]) {
      assert(!resultText.includes(protectedName), `Share response exposed ${protectedName}.`);
    }

    const linkageAttempt = await fetch(`${baseUrl}/api/v1/leads`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: leadEmail,
        consent: true,
        consentVersion: leadConsentVersion,
        shareToken,
      }),
    });
    assert(
      linkageAttempt.status === 422,
      `Lead endpoint accepted a health-result linkage field (${linkageAttempt.status}).`,
    );
    const leadResponse = await fetch(`${baseUrl}/api/v1/leads`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: leadEmail.toUpperCase(),
        consent: true,
        consentVersion: leadConsentVersion,
      }),
    });
    assert(leadResponse.status === 201, `Live lead capture failed (${leadResponse.status}).`);
    assert(leadResponse.headers.get('cache-control') === 'no-store', 'Lead response is cacheable.');
    const storedLead = await LeadModel.findOne({ email: leadEmail }).lean();
    assert(storedLead, 'Lead was not persisted in its separate collection.');
    assert(storedLead.consent === true, 'Lead consent snapshot was not persisted.');
    assert(
      storedLead.consentVersion === leadConsentVersion,
      'Lead consent version snapshot mismatch.',
    );
    const storedLeadText = JSON.stringify(storedLead);
    for (const forbiddenLeadField of [
      'shareToken',
      'assessmentId',
      'resultId',
      'visitorId',
      'calculatorSlug',
    ]) {
      assert(
        !storedLeadText.includes(forbiddenLeadField),
        `Lead persistence included forbidden field ${forbiddenLeadField}.`,
      );
    }

    await ResultModel.updateOne({ _id: result._id }, { $set: { revokedAt: new Date() } });
    const revokedResponse = await fetch(`${baseUrl}/api/v1/results/${shareToken}`);
    assert(
      revokedResponse.status === 404,
      `Revoked share token remained readable (${revokedResponse.status}).`,
    );

    const expiryKey = `p3-expiry-${randomUUID()}`;
    const expiryResponse = await fetch(assessUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': expiryKey },
      body: JSON.stringify({ inputs: { value: 6 } }),
    });
    assert(expiryResponse.status === 200, `Expiry assessment failed (${expiryResponse.status}).`);
    const expiryJson = (await expiryResponse.json()) as { data: { shareToken: string } };
    const expiryResult = await ResultModel.findOne({
      calculatorSlug: slug,
      shareTokenHash: { $exists: true },
    })
      .sort({ createdAt: -1 })
      .lean();
    assert(expiryResult, 'Expiry result was not persisted.');
    await ResultModel.updateOne({ _id: expiryResult._id }, { $set: { expiresAt: new Date(0) } });
    const expiredResponse = await fetch(`${baseUrl}/api/v1/results/${expiryJson.data.shareToken}`);
    assert(
      expiredResponse.status === 404,
      `Expired share token remained readable (${expiredResponse.status}).`,
    );

    console.log(
      JSON.stringify({
        status: 'ok',
        database: environment.mongoDbName,
        transaction: 'assessment-and-result-committed',
        reproducibility: 'exact-calculatorVersionId-and-engine-version-verified',
        share: 'read-revocation-expiry-and-privacy-verified',
        projection: 'live-mongodb-config-and-result-sanitization-verified',
        presentation: 'immutable-scoring-free-display-snapshot-verified',
        leads: 'separate-consented-ttl-persistence-verified',
      }),
    );
  } finally {
    if (server) await closeServer(server);
    await ResultModel.deleteMany({ calculatorSlug: slug });
    await AssessmentModel.deleteMany({ calculatorSlug: slug });
    await CalculatorVersionModel.deleteMany({ calculatorSlug: slug });
    await CalculatorModel.deleteOne({ slug });
    await LeadModel.deleteMany({ email: leadEmail });
    await disconnectDatabase();
  }
}

void main().catch(async (error: unknown) => {
  await disconnectDatabase();
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
