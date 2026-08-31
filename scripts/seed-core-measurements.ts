import { createHash } from 'node:crypto';

import mongoose, { type ClientSession } from 'mongoose';

import { loadEnvironment, loadProjectEnvironment } from '../apps/server/src/config/env';
import { connectDatabase, disconnectDatabase } from '../apps/server/src/db/connection';
import { JobRunModel } from '../apps/server/src/persistence/models/job-run';
import {
  ensureMeasurementRevisionIndexes,
  MeasurementRevisionModel,
} from '../apps/server/src/persistence/models/measurement-revision';
import { stableJsonStringify } from '../packages/contracts/src/index';
import {
  CORE_MEASUREMENT_SEED_PATH,
  readCheckedCoreMeasurementSeed,
  validateCheckedCoreMeasurementSeed,
} from './core-measurement-seed-files';
import {
  CORE_MEASUREMENT_HISTORY_REVISIONS,
  findCoreMeasurementChronologyConflicts,
  preflightCoreMeasurementHistory,
  readCheckedCoreMeasurementHistoryManifest,
  type CoreMeasurementHistoryPreflightResult,
} from './core-measurement-seed-history';
import {
  compareCoreMeasurementRevisionContent,
  CORE_MEASUREMENT_SEED_REVISION,
  type StoredCoreMeasurementRevisionContent,
} from './core-measurement-seed-persistence';

class SeedConflictError extends Error {
  constructor(key: string, revision: number, mismatch: string) {
    super(
      `Refusing to overwrite ${key}@${revision}: stored seed-owned content differs (${mismatch}).`,
    );
    this.name = 'SeedConflictError';
  }
}

class SeedPreflightError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SeedPreflightError';
  }
}

function sha256(value: unknown): string {
  return createHash('sha256').update(stableJsonStringify(value)).digest('hex');
}

const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--apply') || args.length > 1) {
  throw new Error('Usage: npm run measurements:seed [-- --apply]');
}
const apply = args[0] === '--apply';
const seed = readCheckedCoreMeasurementSeed();
const validation = validateCheckedCoreMeasurementSeed(seed);
if (!validation.valid) {
  throw new Error(
    'The checked core measurement seed failed structural, deterministic, or integrity validation.',
  );
}

if (!apply) {
  console.log(
    JSON.stringify(
      {
        status: 'ok',
        mode: 'dry-run',
        connectedToMongoDb: false,
        measurementRevision: CORE_MEASUREMENT_SEED_REVISION,
        path: CORE_MEASUREMENT_SEED_PATH,
        message: 'No database write occurred. Pass --apply explicitly to insert missing drafts.',
        ...validation.integrity.counts,
      },
      null,
      2,
    ),
  );
} else {
  void applySeed().catch(async (error: unknown) => {
    await disconnectDatabase();
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

async function applySeed(): Promise<void> {
  loadProjectEnvironment();
  const environment = loadEnvironment();
  await connectDatabase({ environment });
  // The model intentionally disables auto-indexing so the alias-aware text-index
  // migration can be guarded. Establish and verify the unique revision/index
  // boundary before recording or attempting any seed write.
  await ensureMeasurementRevisionIndexes();

  const manifest = readCheckedCoreMeasurementHistoryManifest();
  const seedKeys = seed.records.map((record) => record.definition.key);
  // Fail before creating even an operational job record. The same checks run
  // again inside the insert transaction to close the read/write race window.
  const initialPreflight = await runSeedPreflight(seedKeys, manifest);

  const scheduledFor = new Date();
  const seedHash = sha256(seed);
  const job = await JobRunModel.create({
    job: 'core-measurement-seed-v1-revision-3',
    scheduledFor,
    status: 'running',
    attempt: 1,
    startedAt: scheduledFor,
    metadata: {
      seedHash,
      sourceSha256: seed.generatedFrom.sha256,
      requestedRecords: seed.records.length,
      lifecycle: 'draft-only',
      measurementRevision: CORE_MEASUREMENT_SEED_REVISION,
      historyDisposition: initialPreflight.disposition,
      historyRowsChecked: initialPreflight.rowsChecked,
      historyRevisionHashes: initialPreflight.revisionHashes,
    },
  });

  try {
    const session = await mongoose.startSession();
    let completed = {
      inserted: 0,
      unchanged: 0,
      history: initialPreflight,
    };
    try {
      await session.withTransaction(async () => {
        const attempt = {
          inserted: 0,
          unchanged: 0,
          history: await runSeedPreflight(seedKeys, manifest, session),
        };
        for (const record of seed.records) {
          const definition = record.definition;
          const definitionHash = sha256(definition);
          const existing = await MeasurementRevisionModel.findOne({
            key: definition.key,
            revision: definition.version,
          })
            .session(session)
            .lean();
          if (existing) {
            const comparison = compareCoreMeasurementRevisionContent(
              record,
              existing as StoredCoreMeasurementRevisionContent,
            );
            if (!comparison.matches) {
              throw new SeedConflictError(definition.key, definition.version, comparison.mismatch);
            }
            attempt.unchanged += 1;
            continue;
          }
          await MeasurementRevisionModel.create(
            [
              {
                key: definition.key,
                revision: definition.version,
                status: 'draft',
                displayName: definition.displayName,
                kind: definition.kind === 'derived-measurement' ? 'derived' : 'biomarker',
                canonicalUnit: definition.canonicalUnit.code,
                definition,
                definitionHash,
                sources: definition.sources,
                migrationProvenance: record.provenance,
              },
            ],
            { session, ordered: true },
          );
          attempt.inserted += 1;
        }
        completed = attempt;
      });
    } finally {
      await session.endSession();
    }

    const finishedAt = new Date();
    await JobRunModel.updateOne(
      { _id: job._id },
      {
        $set: {
          status: 'succeeded',
          finishedAt,
          metadata: {
            seedHash,
            sourceSha256: seed.generatedFrom.sha256,
            requestedRecords: seed.records.length,
            inserted: completed.inserted,
            unchanged: completed.unchanged,
            lifecycle: 'draft-only',
            measurementRevision: CORE_MEASUREMENT_SEED_REVISION,
            historyDisposition: completed.history.disposition,
            historyRowsChecked: completed.history.rowsChecked,
            historyRevisionHashes: completed.history.revisionHashes,
          },
        },
      },
    );
    console.log(
      JSON.stringify(
        {
          status: 'ok',
          mode: 'apply',
          measurementRevision: CORE_MEASUREMENT_SEED_REVISION,
          records: seed.records.length,
          inserted: completed.inserted,
          unchanged: completed.unchanged,
          historyDisposition: completed.history.disposition,
          historyRowsChecked: completed.history.rowsChecked,
          jobRunId: job._id.toString(),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    const finishedAt = new Date();
    const errorCode =
      error instanceof SeedConflictError
        ? 'SEED_HASH_CONFLICT'
        : error instanceof SeedPreflightError
          ? 'SEED_PREFLIGHT_FAILED'
          : 'SEED_APPLY_FAILED';
    await JobRunModel.updateOne(
      { _id: job._id },
      {
        $set: {
          status: 'failed',
          finishedAt,
          errorCode,
          errorMessage:
            error instanceof SeedConflictError
              ? error.message
              : 'Core measurement seed apply failed; inspect protected operational logs.',
        },
      },
    );
    throw error;
  } finally {
    await disconnectDatabase();
  }
}

async function runSeedPreflight(
  seedKeys: readonly string[],
  manifest: ReturnType<typeof readCheckedCoreMeasurementHistoryManifest>,
  session?: ClientSession,
): Promise<CoreMeasurementHistoryPreflightResult> {
  const historyQuery = MeasurementRevisionModel.find({
    key: { $in: seedKeys },
    revision: { $in: CORE_MEASUREMENT_HISTORY_REVISIONS },
  }).select({
    _id: 0,
    key: 1,
    revision: 1,
    status: 1,
    displayName: 1,
    kind: 1,
    canonicalUnit: 1,
    definitionHash: 1,
    definition: 1,
    sources: 1,
    migrationProvenance: 1,
  });
  const chronologyQuery = MeasurementRevisionModel.find({
    key: { $in: seedKeys },
    revision: { $gte: CORE_MEASUREMENT_SEED_REVISION },
  }).select({ _id: 0, key: 1, revision: 1 });
  if (session) {
    historyQuery.session(session);
    chronologyQuery.session(session);
  }
  const [historyRows, chronologyRows] = await Promise.all([
    historyQuery.lean(),
    chronologyQuery.lean(),
  ]);
  let history: CoreMeasurementHistoryPreflightResult;
  try {
    history = preflightCoreMeasurementHistory(
      historyRows as StoredCoreMeasurementRevisionContent[],
      manifest,
      seedKeys,
    );
  } catch (error) {
    throw new SeedPreflightError(error instanceof Error ? error.message : String(error));
  }
  const chronologyConflicts = findCoreMeasurementChronologyConflicts(chronologyRows, seedKeys);
  if (chronologyConflicts.length > 0) {
    throw new SeedPreflightError(
      `Refusing seed apply: revision ${CORE_MEASUREMENT_SEED_REVISION} is missing before a later revision for ${chronologyConflicts.join(', ')}.`,
    );
  }
  return history;
}
