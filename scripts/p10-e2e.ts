import type { ChildProcess } from 'node:child_process';
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { relative, resolve } from 'node:path';

import {
  type AppEnvironment,
  loadEnvironment,
  loadProjectEnvironment,
} from '../apps/server/src/config/env';
import { connectDatabase, disconnectDatabase } from '../apps/server/src/db/connection';
import { spawnWithEvidence, type EvidenceChildProcess } from './child-process-evidence';
import {
  authorizeP7FixtureWrites,
  dropP7FixtureDatabase,
  p7TemporaryDatabaseName,
  seedP7Fixture,
  type P7FixtureWriteAuthorization,
} from './p7-browser-fixture';
import { runPerformanceCheck, type PerformanceCheckResult } from './p10-performance';
import { p10CalculatorSlug } from './p10-fixture-identity';
import {
  assertProtectedTreesUnchanged,
  snapshotProtectedTrees,
  writeSnapshot,
} from './p10-reusability-gate';

const WORKSPACE_ROOT = resolve(__dirname, '..');
const WRITE_OPT_IN = '--allow-temporary-database-write';

function slash(value: string): string {
  return value.replaceAll('\\', '/');
}

async function artifactManifest(
  evidenceDirectory: string,
): Promise<readonly { path: string; bytes: number; sha256: string }[]> {
  const paths: string[] = [];
  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && entry.name !== 'archive-manifest.json') paths.push(path);
    }
  }
  await visit(evidenceDirectory);
  return await Promise.all(
    paths.map(async (path) => {
      const content = await readFile(path);
      return {
        path: slash(relative(evidenceDirectory, path)),
        bytes: content.byteLength,
        sha256: createHash('sha256').update(content).digest('hex'),
      };
    }),
  );
}

async function packageVersion(path: string): Promise<string> {
  const manifest = JSON.parse(await readFile(path, 'utf8')) as { version?: unknown };
  if (typeof manifest.version !== 'string' || !manifest.version.trim()) {
    throw new Error(`Package manifest does not contain a version: ${path}`);
  }
  return manifest.version;
}

function k6Version(): string | null {
  const result = spawnSync('k6', ['version'], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) return null;
  return `${result.stdout}${result.stderr}`.trim() || null;
}

async function availablePort(): Promise<number> {
  return await new Promise<number>((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not allocate an isolated P10 port.'));
        return;
      }
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolvePort(port)));
    });
  });
}

async function waitForHttp(
  url: string,
  expectedStatus: number,
  timeoutMs = 120_000,
  child?: ChildProcess,
  childLabel = 'Child process',
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let latest = 'not attempted';
  while (Date.now() < deadline) {
    if (child && (child.exitCode !== null || child.signalCode !== null)) {
      throw new Error(
        `${childLabel} exited before ${url} became ready (code ${String(child.exitCode)}, signal ${String(child.signalCode)}).`,
      );
    }
    try {
      const response = await fetch(url, { redirect: 'manual' });
      latest = `HTTP ${response.status}`;
      await response.body?.cancel();
      if (response.status === expectedStatus) return;
    } catch (error) {
      latest = error instanceof Error ? error.message : 'request failed';
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }
  throw new Error(`Timed out waiting for ${url}; latest result was ${latest}.`);
}

async function waitForChild(child: ChildProcess, label: string): Promise<void> {
  const code = await new Promise<number | null>((resolveExit, reject) => {
    child.once('error', reject);
    child.once('exit', resolveExit);
  });
  if (code !== 0) throw new Error(`${label} exited with code ${String(code)}.`);
}

async function stopChild(child: ChildProcess | undefined): Promise<void> {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  const exited = new Promise<void>((resolveExit) => child.once('exit', () => resolveExit()));
  await Promise.race([
    exited,
    new Promise<void>((resolveTimeout) => setTimeout(resolveTimeout, 10_000)),
  ]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
    await Promise.race([
      exited,
      new Promise<void>((resolveTimeout) => setTimeout(resolveTimeout, 5_000)),
    ]);
  }
}

async function seed(
  environment: AppEnvironment,
  nonce: string,
  authorization: P7FixtureWriteAuthorization,
): Promise<void> {
  await connectDatabase({ environment });
  try {
    await seedP7Fixture(nonce, authorization);
  } finally {
    await disconnectDatabase();
  }
}

async function cleanup(
  environment: AppEnvironment,
  nonce: string,
  authorization: P7FixtureWriteAuthorization,
): Promise<void> {
  await connectDatabase({ environment });
  try {
    await dropP7FixtureDatabase(nonce, authorization);
  } finally {
    await disconnectDatabase();
  }
}

async function main(): Promise<void> {
  if (!process.argv.includes(WRITE_OPT_IN)) {
    throw new Error(`P10 isolated Atlas execution requires the explicit ${WRITE_OPT_IN} opt-in.`);
  }
  loadProjectEnvironment();
  if (!process.env.MONGODB_URI?.trim()) throw new Error('MONGODB_URI is required for P10 E2E.');
  const nonce = randomBytes(15).toString('hex');
  const databaseName = p7TemporaryDatabaseName(nonce);
  const serverPort = await availablePort();
  const clientPort = await availablePort();
  const apiBaseUrl = `http://127.0.0.1:${serverPort}/api/v1`;
  const clientUrl = `http://127.0.0.1:${clientPort}`;
  const calculatorSlug = p10CalculatorSlug(nonce);
  const executionId = `p10-${nonce}-${randomUUID().slice(0, 8)}`;
  const evidenceDirectory = resolve(WORKSPACE_ROOT, 'tmp', 'p10-evidence', executionId);
  const playwrightArtifactsDirectory = resolve(evidenceDirectory, 'playwright-artifacts');
  const playwrightReportDirectory = resolve(evidenceDirectory, 'playwright-report');
  const nextDistDirectoryName = `.next-p10-${nonce}`;
  const nextDistDirectory = resolve(WORKSPACE_ROOT, 'apps', 'client', nextDistDirectoryName);
  await mkdir(resolve(evidenceDirectory, 'logs'), { recursive: true });
  const protectedBefore = await snapshotProtectedTrees(WORKSPACE_ROOT);
  await writeSnapshot(resolve(evidenceDirectory, 'protected-before.json'), protectedBefore);

  const authAccessSecret = randomBytes(48).toString('base64url');
  const authRefreshSecret = randomBytes(48).toString('base64url');
  const analyticsHashSecret = randomBytes(48).toString('base64url');
  const cacheInvalidationSigningSecret = randomBytes(48).toString('base64url');
  const cacheInvalidationEndpoint = `${clientUrl}/api/v1/internal/revalidate`;
  const environment = loadEnvironment({
    ...process.env,
    NODE_ENV: 'test',
    MONGODB_DB_NAME: databaseName,
    PORT: String(serverPort),
    HOST: '127.0.0.1',
    CORS_ORIGINS: clientUrl,
    AUTH_ACCESS_SECRET: authAccessSecret,
    AUTH_REFRESH_SECRET: authRefreshSecret,
    ANALYTICS_HASH_SECRET: analyticsHashSecret,
    CACHE_INVALIDATION_ENDPOINT: cacheInvalidationEndpoint,
    CACHE_INVALIDATION_SIGNING_SECRET: cacheInvalidationSigningSecret,
    ANALYTICS_EVENTS_RETENTION_DAYS: '1',
    ASSESSMENT_RETENTION_DAYS: '1',
    ANALYTICS_VISITOR_PERSISTENCE_ENABLED: 'false',
    LOG_LEVEL: 'warn',
  });

  let authorization: P7FixtureWriteAuthorization | undefined;
  let server: ChildProcess | undefined;
  let client: ChildProcess | undefined;
  let operationError: unknown;
  let performance: PerformanceCheckResult | undefined;
  const runK6Setting = process.env.P10_RUN_K6?.trim();
  const runK6 = runK6Setting === 'true';
  let k6Completed = false;
  let protectedAfter: Awaited<ReturnType<typeof snapshotProtectedTrees>> | undefined;
  const evidenceChildren: EvidenceChildProcess[] = [];
  function startProcess(
    command: string,
    arguments_: readonly string[],
    environment: NodeJS.ProcessEnv,
    label: string,
  ): ChildProcess {
    const logged = spawnWithEvidence({
      command,
      arguments: arguments_,
      cwd: WORKSPACE_ROOT,
      environment,
      evidenceDirectory,
      label,
    });
    evidenceChildren.push(logged);
    return logged.child;
  }
  function startNode(
    script: string,
    arguments_: readonly string[],
    environment: NodeJS.ProcessEnv,
    label: string,
  ): ChildProcess {
    return startProcess(
      process.execPath,
      [resolve(WORKSPACE_ROOT, script), ...arguments_],
      environment,
      label,
    );
  }
  try {
    if (runK6Setting && runK6Setting !== 'true' && runK6Setting !== 'false') {
      throw new Error('P10_RUN_K6 must be exactly true or false when provided.');
    }
    // Retain the exact cleanup authority before the first possible fixture
    // write. If seeding fails after a partial write, the finally path can still
    // perform the ownership-checked cleanup (or record why it was refused).
    authorization = authorizeP7FixtureWrites(environment, nonce, [WRITE_OPT_IN]);
    await seed(environment, nonce, authorization);
    const sharedEnvironment: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: 'test',
      MONGODB_DB_NAME: databaseName,
      PORT: String(serverPort),
      HOST: '127.0.0.1',
      CORS_ORIGINS: clientUrl,
      AUTH_ACCESS_SECRET: authAccessSecret,
      AUTH_REFRESH_SECRET: authRefreshSecret,
      ANALYTICS_HASH_SECRET: analyticsHashSecret,
      CACHE_INVALIDATION_ENDPOINT: cacheInvalidationEndpoint,
      CACHE_INVALIDATION_SIGNING_SECRET: cacheInvalidationSigningSecret,
      ANALYTICS_EVENTS_RETENTION_DAYS: '1',
      ASSESSMENT_RETENTION_DAYS: '1',
      ANALYTICS_VISITOR_PERSISTENCE_ENABLED: 'false',
      LOG_LEVEL: 'warn',
      API_BASE_URL: apiBaseUrl,
      NEXT_PUBLIC_API_BASE_URL: apiBaseUrl,
      P10_E2E_NONCE: nonce,
      P10_CALCULATOR_SLUG: calculatorSlug,
      P10_API_BASE_URL: apiBaseUrl,
      P10_CLIENT_URL: clientUrl,
      P10_PLAYWRIGHT_OUTPUT_DIR: playwrightArtifactsDirectory,
      P10_PLAYWRIGHT_REPORT_DIR: playwrightReportDirectory,
      P10_PERFORMANCE_INPUTS: JSON.stringify({ readinessValue: 0, markerValue: 60 }),
      NIRO_NEXT_DIST_DIR: nextDistDirectoryName,
    };
    const startApiServer = (label: string): ChildProcess =>
      startNode(
        'apps/server/dist/server.js',
        [],
        {
          ...sharedEnvironment,
          NODE_ENV: 'test',
        },
        label,
      );
    server = startApiServer('api-server');
    await waitForHttp(
      `http://127.0.0.1:${serverPort}/readyz`,
      200,
      300_000,
      server,
      'Isolated P10 API server',
    );
    const clientProductionEnvironment: NodeJS.ProcessEnv = {
      ...sharedEnvironment,
      NODE_ENV: 'production',
      HOSTNAME: '127.0.0.1',
      PORT: String(clientPort),
      NEXT_PUBLIC_RELEASE_ID: executionId,
    };
    const clientBuild = startNode(
      'node_modules/next/dist/bin/next',
      ['build', 'apps/client'],
      clientProductionEnvironment,
      'next-client-build',
    );
    await waitForChild(clientBuild, 'Isolated P10 Next.js production build');
    const clientStage = startNode(
      'scripts/prepare-next-standalone.mjs',
      [],
      clientProductionEnvironment,
      'next-client-standalone-stage',
    );
    await waitForChild(clientStage, 'Isolated P10 Next.js standalone staging');
    client = startNode(
      `apps/client/${nextDistDirectoryName}/standalone/apps/client/server.js`,
      [],
      clientProductionEnvironment,
      'next-client',
    );
    await waitForHttp(
      `${clientUrl}/admin/login`,
      200,
      300_000,
      client,
      'Isolated P10 Next.js client',
    );
    const playwright = startNode(
      'node_modules/@playwright/test/cli.js',
      ['test', '--config', 'playwright.config.ts'],
      sharedEnvironment,
      'playwright',
    );
    await waitForChild(playwright, 'Playwright P10 gate');

    if (runK6) {
      const k6 = startProcess(
        'k6',
        [
          'run',
          '--summary-export',
          resolve(evidenceDirectory, 'k6-summary.json'),
          resolve(WORKSPACE_ROOT, 'tests', 'performance', 'public-assess.k6.js'),
        ],
        { ...sharedEnvironment, K6_NO_USAGE_REPORT: 'true' },
        'k6',
      );
      await waitForChild(k6, 'k6 P10 performance scenario');
      k6Completed = true;

      // k6 and the independent Node sampler intentionally exercise the real
      // anonymous production quota. Restart only the isolated fixture server
      // between samplers so neither test consumes the other's in-memory bucket.
      await stopChild(server);
      server = startApiServer('api-server-node-performance');
      await waitForHttp(
        `http://127.0.0.1:${serverPort}/readyz`,
        200,
        300_000,
        server,
        'Restarted isolated P10 API server',
      );
    }

    performance = await runPerformanceCheck({
      apiBaseUrl,
      calculatorSlug,
      inputs: { readinessValue: 0, markerValue: 60 },
      requests: 18,
      concurrency: 3,
      p95BudgetMs: 300,
    });
    protectedAfter = await snapshotProtectedTrees(WORKSPACE_ROOT);
    assertProtectedTreesUnchanged(protectedBefore, protectedAfter);
    await writeSnapshot(resolve(evidenceDirectory, 'protected-after.json'), protectedAfter);
  } catch (error) {
    operationError = error;
  } finally {
    await Promise.all([stopChild(client), stopChild(server)]);
    try {
      await Promise.all(evidenceChildren.map(async (entry) => await entry.logsFlushed));
    } catch (error) {
      operationError ??= error;
    }
    try {
      await rm(nextDistDirectory, { recursive: true, force: true });
    } catch (error) {
      operationError ??= error;
    }
  }

  let cleanupError: unknown;
  let cleanupCompletedAtUtc: string | undefined;
  if (authorization) {
    try {
      await cleanup(environment, nonce, authorization);
      cleanupCompletedAtUtc = new Date().toISOString();
      await writeFile(
        resolve(evidenceDirectory, 'atlas-cleanup-verification.json'),
        `${JSON.stringify(
          {
            schemaVersion: 'niro-p10-atlas-cleanup-verification.v1',
            status: 'ok',
            executionId,
            database: databaseName,
            fixtureOnly: true,
            ownershipVerifiedBeforeDrop: true,
            namespacePresentAfterDrop: false,
            completedAtUtc: cleanupCompletedAtUtc,
          },
          null,
          2,
        )}\n`,
        'utf8',
      );
    } catch (error) {
      cleanupError = error;
    }
  }
  if (operationError || cleanupError || !protectedAfter || !performance) {
    await writeFile(
      resolve(evidenceDirectory, 'failure.json'),
      `${JSON.stringify(
        {
          schemaVersion: 'p10-reusability-gate-failure.v1',
          status: 'failed',
          executionId,
          fixtureOnly: true,
          isolatedDatabase: databaseName,
          passingEvidence: false,
          childProcessLogs: evidenceChildren.map((entry) => ({
            label: entry.label,
            stdout: entry.stdoutArtifact,
            stderr: entry.stderrArtifact,
          })),
          k6: {
            requested: runK6,
            completed: k6Completed,
            summaryArtifact: k6Completed ? 'k6-summary.json' : null,
          },
          operationError:
            operationError instanceof Error
              ? operationError.message
              : operationError
                ? String(operationError)
                : null,
          guardedAtlasCleanup: cleanupError
            ? 'failed'
            : authorization
              ? 'completed'
              : 'not-required',
          cleanupError:
            cleanupError instanceof Error
              ? cleanupError.message
              : cleanupError
                ? String(cleanupError)
                : null,
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
  }
  if (operationError && cleanupError) {
    throw new AggregateError(
      [operationError, cleanupError],
      'P10 gate failed and guarded Atlas cleanup also failed.',
    );
  }
  if (cleanupError) throw cleanupError;
  if (operationError) throw operationError;
  if (!protectedAfter || !performance) {
    throw new Error('P10 gate did not produce complete protected-source and performance evidence.');
  }
  const completedAtUtc = new Date().toISOString();
  const summary = {
    schemaVersion: 'p10-reusability-gate-run.v1',
    status: 'ok',
    executionId,
    fixtureOnly: true,
    isolatedDatabase: databaseName,
    calculatorSlug,
    createdFromBlankStudioDraft: true,
    fullConfigurationJsonImportUsed: false,
    subsequentlyEditedReviewedPublishedViaStudioUi: true,
    protectedImplementationSha256: protectedAfter.combinedSha256,
    protectedImplementationDifferences: [],
    guardedAtlasCleanup: 'completed',
    cleanupCompletedAtUtc,
    performance,
    k6: {
      requested: runK6,
      completed: k6Completed,
      summaryArtifact: k6Completed ? 'k6-summary.json' : null,
    },
    childProcessLogs: evidenceChildren.map((entry) => ({
      label: entry.label,
      stdout: entry.stdoutArtifact,
      stderr: entry.stderrArtifact,
    })),
    playwrightArtifacts: 'playwright-artifacts',
    playwrightReport: 'playwright-report',
  };
  await writeFile(
    resolve(evidenceDirectory, 'summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8',
  );
  const playwrightVersion = await packageVersion(
    resolve(WORKSPACE_ROOT, 'node_modules', '@playwright', 'test', 'package.json'),
  );
  const k6Identity = k6Completed ? k6Version() : null;
  if (k6Completed && !k6Identity) {
    throw new Error('Completed k6 execution could not be paired with a runtime version identity.');
  }
  await writeFile(
    resolve(evidenceDirectory, 'archive-manifest.json'),
    `${JSON.stringify(
      {
        schemaVersion: 'niro-p10-evidence-archive.v1',
        executionId,
        status: 'ok',
        completedAtUtc,
        owner: process.env.P10_EVIDENCE_OWNER?.trim() || 'local workspace operator',
        sourceRevision: process.env.P10_SOURCE_REVISION?.trim() || 'unavailable-no-git-metadata',
        releaseId: executionId,
        deploymentShape: 'native Node API plus staged Next.js standalone server',
        runtime: {
          node: process.version,
          npmUserAgent: process.env.npm_config_user_agent ?? null,
          platform: process.platform,
          architecture: process.arch,
          playwright: playwrightVersion,
          browser: 'bundled Chromium',
        },
        k6: { requested: runK6, completed: k6Completed, version: k6Identity },
        performance,
        protectedImplementationSha256: protectedAfter.combinedSha256,
        artifacts: await artifactManifest(evidenceDirectory),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  console.log(
    JSON.stringify({
      status: 'ok',
      executionId,
      fixtureOnly: true,
      database: databaseName,
      calculatorSlug,
      guardedAtlasCleanup: 'completed',
      protectedImplementationSha256: protectedAfter.combinedSha256,
      performance,
      evidenceDirectory,
    }),
  );
}

void main().catch(async (error: unknown) => {
  await disconnectDatabase();
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
