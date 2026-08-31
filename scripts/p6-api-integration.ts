import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';

import { createApp } from '../apps/server/src/app';
import { loadEnvironment, loadProjectEnvironment } from '../apps/server/src/config/env';
import { connectDatabase, disconnectDatabase } from '../apps/server/src/db/connection';
import { stableMeasurementHash } from '../apps/server/src/modules/measurement-contract';
import {
  ensureMeasurementRevisionIndexes,
  MeasurementRevisionModel,
} from '../apps/server/src/persistence/models/measurement-revision';
import { CalculatorVersionModel } from '../apps/server/src/persistence/models/calculator-version';
import {
  authorizeP6FixtureWrites,
  canonicalP6CalculatorVersionHash,
  cleanupP6Fixture,
  p6FixtureKeys,
  p6TemporaryDatabaseName,
  seedP6Fixture,
} from './p6-browser-fixture';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function safeErrorMessages(error: unknown): readonly string[] {
  if (error instanceof AggregateError) {
    return [error.message, ...error.errors.flatMap(safeErrorMessages)];
  }
  return [error instanceof Error ? error.message : String(error)];
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    server.close((error: Error | undefined) => (error ? reject(error) : resolve())),
  );
}

async function jsonData(response: Response): Promise<unknown> {
  const body = (await response.json()) as { data?: unknown };
  return body.data;
}

async function main(): Promise<void> {
  loadProjectEnvironment();
  const configuredEnvironment = loadEnvironment();
  if (!configuredEnvironment.mongoUri) throw new Error('MONGODB_URI is not configured.');

  // MongoDB limits database names to 38 bytes. `niro_p6_` plus a 30-hex
  // (120-bit) nonce uses the full allowance without sacrificing isolation.
  const prefix = `p6-ui-${randomUUID().replaceAll('-', '').slice(0, 30)}`;
  const environment = {
    ...configuredEnvironment,
    mongoDbName: p6TemporaryDatabaseName(prefix),
  };
  const authorization = authorizeP6FixtureWrites(environment, prefix, process.argv.slice(2));
  const databaseClient = await connectDatabase({ environment });
  const temporaryDatabase = databaseClient.connection.db;
  assert(
    temporaryDatabase?.databaseName === authorization.databaseName,
    'P6 integration database isolation could not be verified.',
  );
  const keys = p6FixtureKeys(prefix);
  let server: Server | undefined;
  let seedAttempted = false;
  let failure: unknown;
  try {
    await ensureMeasurementRevisionIndexes();
    seedAttempted = true;
    await seedP6Fixture(prefix, authorization);
    const app = createApp(environment, { databaseReady: () => true });
    server = app.listen(0);
    const address = server.address();
    assert(address && typeof address !== 'string', 'P6 integration server unavailable.');
    const base = `http://127.0.0.1:${address.port}/api/v1`;

    const domainResponse = await fetch(
      `${base}/biomarkers?domain=${encodeURIComponent('synthetic-domain')}`,
    );
    assert(domainResponse.status === 200, `Domain list failed (${domainResponse.status}).`);
    const domainItems = (await jsonData(domainResponse)) as readonly Record<string, unknown>[];
    const primaryItems = domainItems.filter((item) => item.key === keys.primary);
    assert(primaryItems.length === 1, 'Latest verified revision was not uniquely selected.');
    assert(primaryItems[0]?.revision === 2, 'Public list did not select the latest revision.');
    assert(
      primaryItems[0]?.displayName === 'Synthetic evidence marker',
      'Public list returned a stale revision.',
    );
    const domainText = JSON.stringify(domainItems);
    assert(!domainText.includes(keys.draft), 'A draft measurement became public.');
    assert(!domainText.includes(keys.retired), 'A retired measurement became public.');
    assert(!domainText.includes('Older synthetic marker revision'), 'An older revision leaked.');
    const listTag = domainResponse.headers.get('etag');
    assert(listTag, 'Biomarker list omitted an ETag.');
    const list304 = await fetch(
      `${base}/biomarkers?domain=${encodeURIComponent('synthetic-domain')}`,
      { headers: { 'If-None-Match': listTag } },
    );
    assert(list304.status === 304, `Biomarker list ETag failed (${list304.status}).`);

    const aliasResponse = await fetch(
      `${base}/biomarkers?search=${encodeURIComponent('Two word marker')}`,
    );
    assert(aliasResponse.status === 200, `Alias search failed (${aliasResponse.status}).`);
    const aliasItems = (await jsonData(aliasResponse)) as readonly Record<string, unknown>[];
    assert(
      aliasItems.some((item) => item.key === keys.primary),
      'Alias-aware MongoDB search did not return the reviewed measurement.',
    );

    const detailResponse = await fetch(`${base}/biomarkers/${keys.primary}`);
    assert(detailResponse.status === 200, `Biomarker detail failed (${detailResponse.status}).`);
    const detail = (await jsonData(detailResponse)) as Record<string, unknown>;
    assert(detail.revision === 2, 'Detail did not select the latest verified revision.');
    const related = detail.relatedBiomarkers as readonly Record<string, unknown>[];
    const usedIn = detail.usedInCalculators as readonly Record<string, unknown>[];
    assert(
      related.some((item) => item.key === keys.related),
      'Same-domain reviewed relation was not returned.',
    );
    assert(
      usedIn.some((item) => item.calculatorSlug === keys.calculator),
      'Published calculator interlink was not derived from the live version.',
    );
    const [currentMeasurement, persistedVersion] = await Promise.all([
      MeasurementRevisionModel.findOne({ key: keys.primary, revision: 2 }).lean(),
      CalculatorVersionModel.findOne({ calculatorSlug: keys.calculator, version: 1 }).lean(),
    ]);
    assert(
      currentMeasurement && persistedVersion,
      'Fixture dependency records were not persisted.',
    );
    assert(
      persistedVersion.measurementRevisionIds.length === 1 &&
        persistedVersion.measurementRevisionIds[0] === currentMeasurement._id.toString(),
      'Calculator version is not bound to the actual current measurement revision ID.',
    );
    const measurementSnapshot = persistedVersion.measurementSnapshots[0] as
      Record<string, unknown> | undefined;
    assert(
      persistedVersion.measurementSnapshots.length === 1 &&
        measurementSnapshot?.measurementRevisionId === currentMeasurement._id.toString() &&
        measurementSnapshot.definitionHash === currentMeasurement.definitionHash &&
        stableMeasurementHash(measurementSnapshot.definition) === currentMeasurement.definitionHash,
      'Calculator version does not contain the exact immutable measurement snapshot.',
    );
    assert(
      persistedVersion.versionHash ===
        canonicalP6CalculatorVersionHash(
          keys.calculator,
          1,
          persistedVersion.payload as Record<string, unknown>,
        ),
      'Calculator version hash is not the canonical payload hash.',
    );
    const detailText = JSON.stringify(detail);
    for (const protectedValue of [
      'must-not-be-public',
      'privateReviewerId',
      'formula',
      'governance',
      'definitionHash',
      'reviewHash',
      'reviewedBy',
    ]) {
      assert(!detailText.includes(protectedValue), `Detail exposed ${protectedValue}.`);
    }
    assert(detailText.includes('Organization A interval'), 'Structured range A was omitted.');
    assert(detailText.includes('Organization B interval'), 'Structured range B was omitted.');
    assert(detailText.includes('Synthetic evidence A'), 'Public source provenance was omitted.');
    const detailTag = detailResponse.headers.get('etag');
    assert(detailTag, 'Biomarker detail omitted an ETag.');
    const detail304 = await fetch(`${base}/biomarkers/${keys.primary}`, {
      headers: { 'If-None-Match': detailTag },
    });
    assert(detail304.status === 304, `Biomarker detail ETag failed (${detail304.status}).`);

    const unknownQuery = await fetch(`${base}/biomarkers?unexpected=value`);
    assert(unknownQuery.status === 422, 'Unknown biomarker query was not rejected.');
    const missing = await fetch(`${base}/biomarkers/${keys.draft}`);
    assert(missing.status === 404, 'Draft biomarker detail was accessible.');

    const indexes = await MeasurementRevisionModel.collection.indexes();
    const textIndex = indexes.find((index) =>
      Object.values(index.key).some((value) => value === 'text'),
    );
    assert(textIndex, 'Biomarker search text index is missing.');
    const weights = textIndex.weights as Record<string, number> | undefined;
    assert(weights?.['definition.aliases'], 'Biomarker text index does not include aliases.');

    console.log(
      JSON.stringify({
        status: 'ok',
        database: environment.mongoDbName,
        visibility: 'latest-verified-only',
        search: 'alias-text-index-verified',
        filters: 'nested-domain-and-query-validation-verified',
        caching: 'list-detail-etag-304-verified',
        relations: 'same-domain-and-published-calculator-verified',
        dependencies: 'actual-measurement-revision-and-immutable-snapshot-verified',
        isolation: 'unique-temporary-database-with-explicit-write-opt-in',
        projection: 'protected-fields-excluded',
      }),
    );
  } catch (error) {
    failure = error;
  } finally {
    const cleanupFailures: unknown[] = [];
    if (server) {
      try {
        await closeServer(server);
      } catch (error) {
        cleanupFailures.push(error);
      }
    }
    if (seedAttempted) {
      try {
        await cleanupP6Fixture(prefix, authorization);
      } catch (error) {
        cleanupFailures.push(error);
      }
    }
    if (cleanupFailures.length === 0 && temporaryDatabase) {
      try {
        assert(
          temporaryDatabase.databaseName === p6TemporaryDatabaseName(prefix),
          'Refusing to drop a database outside the unique P6 temporary namespace.',
        );
        await temporaryDatabase.dropDatabase();
      } catch (error) {
        cleanupFailures.push(error);
      }
    }
    try {
      await disconnectDatabase();
    } catch (error) {
      cleanupFailures.push(error);
    }
    if (cleanupFailures.length) {
      failure = failure
        ? new AggregateError(
            [failure, ...cleanupFailures],
            'P6 integration failed and cleanup was incomplete.',
          )
        : new AggregateError(cleanupFailures, 'P6 integration cleanup failed.');
    }
  }
  if (failure) throw failure;
}

void main().catch(async (error: unknown) => {
  try {
    await disconnectDatabase();
  } catch {
    // Preserve the original integration failure.
  }
  console.error(JSON.stringify({ status: 'error', errors: safeErrorMessages(error) }));
  process.exitCode = 1;
});
