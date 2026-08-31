import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { loadEnvironment, loadProjectEnvironment } from '../apps/server/src/config/env';
import { connectDatabase, disconnectDatabase } from '../apps/server/src/db/connection';
import { MeasurementRevisionModel } from '../apps/server/src/persistence/models/measurement-revision';
import {
  buildCoreMeasurementHistoryManifest,
  CORE_MEASUREMENT_HISTORY_REVISIONS,
  preflightCoreMeasurementHistory,
  readCheckedCoreMeasurementHistoryManifest,
} from './core-measurement-seed-history';
import type { StoredCoreMeasurementRevisionContent } from './core-measurement-seed-persistence';

const args = process.argv.slice(2);
if (args.some((argument) => argument !== '--print-candidate') || args.length > 1) {
  throw new Error('Usage: tsx scripts/check-core-measurement-seed-history.ts [--print-candidate]');
}
const printCandidate = args[0] === '--print-candidate';

void run().catch(async (error: unknown) => {
  await disconnectDatabase();
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

async function run(): Promise<void> {
  loadProjectEnvironment();
  await connectDatabase({ environment: loadEnvironment() });
  try {
    const seed = JSON.parse(
      readFileSync(
        join(resolve(__dirname, '..'), 'data', 'seeds', 'core-measurements.v1.seed.json'),
        'utf8',
      ),
    ) as { readonly records: readonly { readonly definition: { readonly key: string } }[] };
    const keys = seed.records.map((record) => record.definition.key);
    const rows = (await MeasurementRevisionModel.find({
      key: { $in: keys },
      revision: { $in: CORE_MEASUREMENT_HISTORY_REVISIONS },
    })
      .select({
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
      })
      .sort({ revision: 1, key: 1 })
      .lean()) as StoredCoreMeasurementRevisionContent[];

    if (printCandidate) {
      console.log(JSON.stringify(buildCoreMeasurementHistoryManifest(rows), null, 2));
      return;
    }

    const manifest = readCheckedCoreMeasurementHistoryManifest();
    const result = preflightCoreMeasurementHistory(rows, manifest, keys);
    console.log(
      JSON.stringify(
        {
          status: 'ok',
          mode: 'read-only',
          collection: 'biomarkers',
          ...result,
        },
        null,
        2,
      ),
    );
  } finally {
    await disconnectDatabase();
  }
}
