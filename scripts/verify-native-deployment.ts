import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

interface NativeProcessContract {
  readonly schemaVersion: number;
  readonly selectedDeploymentMode: string;
  readonly containersRequired: boolean;
  readonly runtime: { readonly node: string; readonly packageManager: string };
  readonly processes: Record<
    string,
    {
      readonly buildCommand?: string;
      readonly startCommand: string;
      readonly healthPath?: string;
      readonly binding?: {
        readonly hostVariable: string;
        readonly hostValue: string;
        readonly portVariable: string;
      };
      readonly replicas?: { readonly maximumUntilCacheCoherenceProven?: number };
      readonly schedule?: { readonly cron: string; readonly timeZone: string };
    }
  >;
}

function requiredFile(root: string, relativePath: string): void {
  if (!existsSync(resolve(root, relativePath))) {
    throw new Error(`Native deployment artifact is missing: ${relativePath}`);
  }
}

function requiredNonEmptyDirectory(root: string, relativePath: string): void {
  const path = resolve(root, relativePath);
  if (!existsSync(path) || readdirSync(path).length === 0) {
    throw new Error(`Native deployment artifact directory is missing or empty: ${relativePath}`);
  }
}

type VerificationScope = 'all' | 'server' | 'client';

export function verifyNativeDeploymentArtifacts(
  root = process.cwd(),
  scope: VerificationScope = 'all',
) {
  const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
    readonly packageManager?: string;
    readonly scripts?: Record<string, string>;
  };
  const clientPackage = JSON.parse(
    readFileSync(resolve(root, 'apps/client/package.json'), 'utf8'),
  ) as { readonly scripts?: Record<string, string> };
  const contract = JSON.parse(
    readFileSync(resolve(root, 'deploy/native/processes.json'), 'utf8'),
  ) as NativeProcessContract;

  if (
    contract.schemaVersion !== 1 ||
    contract.selectedDeploymentMode !== 'native-node' ||
    contract.containersRequired !== false
  ) {
    throw new Error('Native process contract must select the non-container Node deployment mode.');
  }
  if (
    packageJson.packageManager !== contract.runtime.packageManager ||
    contract.runtime.node !== '24.x'
  ) {
    throw new Error('Native runtime versions do not match the repository deployment contract.');
  }
  if (process.versions.node.split('.')[0] !== '24') {
    throw new Error(
      'Native deployment verification must run with the selected Node 24 LTS runtime.',
    );
  }
  const npmUserAgent = process.env.npm_config_user_agent?.split(' ')[0];
  if (npmUserAgent !== 'npm/11.6.1') {
    throw new Error('Native deployment verification must run through npm 11.6.1.');
  }

  const expectedScripts: Record<string, string> = {
    'deploy:build:server-native':
      'npm run build --workspace @niro/contracts && npm run build --workspace @niro/engine && npm run build --workspace @niro/server',
    'deploy:build:client-native':
      'npm run build --workspace @niro/contracts && npm run build --workspace @niro/client',
    'deploy:start:server-native': 'node apps/server/dist/server.js',
    'deploy:start:client-native': 'node apps/client/.next/standalone/apps/client/server.js',
    'deploy:job:analytics-partial': 'node scripts/run-native-job.mjs analytics-partial',
    'deploy:job:analytics-final': 'node scripts/run-native-job.mjs analytics-final',
    'deploy:job:cache': 'node scripts/run-native-job.mjs cache',
  };
  for (const [name, command] of Object.entries(expectedScripts)) {
    if (packageJson.scripts?.[name] !== command) {
      throw new Error(`Native deployment script ${name} is missing or has drifted.`);
    }
  }
  if (clientPackage.scripts?.start !== 'node .next/standalone/apps/client/server.js') {
    throw new Error('Client production start must use the prepared standalone server.');
  }

  const expectedProcesses = {
    api: 'npm run deploy:start:server-native',
    web: 'npm run deploy:start:client-native',
    analyticsPartial: 'npm run deploy:job:analytics-partial',
    analyticsFinal: 'npm run deploy:job:analytics-final',
    cacheInvalidation: 'npm run deploy:job:cache',
  };
  for (const [name, startCommand] of Object.entries(expectedProcesses)) {
    if (contract.processes[name]?.startCommand !== startCommand) {
      throw new Error(`Native process ${name} is missing or has a drifted start command.`);
    }
  }
  if (
    contract.processes.web?.replicas?.maximumUntilCacheCoherenceProven !== 1 ||
    contract.processes.api?.healthPath !== '/readyz' ||
    contract.processes.web?.healthPath !== '/api/healthz' ||
    contract.processes.api?.binding?.hostVariable !== 'HOST' ||
    contract.processes.web?.binding?.hostVariable !== 'HOSTNAME' ||
    contract.processes.api?.binding?.hostValue !== '0.0.0.0' ||
    contract.processes.web?.binding?.hostValue !== '0.0.0.0' ||
    contract.processes.api?.binding?.portVariable !== 'PORT' ||
    contract.processes.web?.binding?.portVariable !== 'PORT'
  ) {
    throw new Error('Native binding, health, or single-web-instance safety contract has drifted.');
  }

  const serverArtifacts = [
    'apps/server/dist/server.js',
    'apps/server/dist/ops/analytics-rollup-cli.js',
    'apps/server/dist/ops/cache-invalidation-cli.js',
  ];
  const clientArtifacts = [
    'apps/client/.next/standalone/apps/client/server.js',
    'apps/client/.next/standalone/packages/contracts/schemas/calculator-version.v1.schema.json',
    'apps/client/.next/standalone/packages/contracts/schemas/measurement-definition.v1.schema.json',
    'apps/client/.next/standalone/apps/client/packages/contracts/schemas/calculator-version.v1.schema.json',
    'apps/client/.next/standalone/apps/client/packages/contracts/schemas/measurement-definition.v1.schema.json',
  ];
  const requiredArtifacts = [
    ...(scope === 'all' || scope === 'server' ? serverArtifacts : []),
    ...(scope === 'all' || scope === 'client' ? clientArtifacts : []),
  ];
  for (const path of requiredArtifacts) {
    requiredFile(root, path);
  }
  if (scope === 'all' || scope === 'client') {
    requiredNonEmptyDirectory(root, 'apps/client/.next/standalone/apps/client/.next/static');
  }

  return {
    status: 'ok' as const,
    deploymentMode: contract.selectedDeploymentMode,
    node: contract.runtime.node,
    observedNode: process.versions.node,
    observedPackageManager: npmUserAgent,
    packageManager: contract.runtime.packageManager,
    scope,
    processes: Object.keys(expectedProcesses).length,
  };
}

if (require.main === module) {
  try {
    const scopeArgument = process.argv.slice(2);
    if (
      scopeArgument.length > 1 ||
      (scopeArgument[0] !== undefined &&
        !['--scope=all', '--scope=server', '--scope=client'].includes(scopeArgument[0]))
    ) {
      throw new Error('Usage: [--scope=all|server|client]');
    }
    const scope = (scopeArgument[0]?.slice('--scope='.length) ?? 'all') as VerificationScope;
    console.log(JSON.stringify(verifyNativeDeploymentArtifacts(process.cwd(), scope)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Native deployment validation failed.');
    process.exitCode = 1;
  }
}
