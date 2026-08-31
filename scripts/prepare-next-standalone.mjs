import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const clientRoot = join(workspaceRoot, 'apps', 'client');
const configuredDistDirectory = process.env.NIRO_NEXT_DIST_DIR?.trim();
const distDirectory = configuredDistDirectory || '.next';

if (distDirectory !== '.next' && !/^\.next-p10-[a-f0-9]{30}$/u.test(distDirectory)) {
  throw new Error('Refusing to prepare an unrecognized Next.js distribution directory.');
}

const distributionRoot = join(clientRoot, distDirectory);
const standaloneRoot = join(distributionRoot, 'standalone');
const clientRuntimeRoot = join(standaloneRoot, 'apps', 'client');
const standaloneServer = join(clientRuntimeRoot, 'server.js');

if (!existsSync(standaloneServer)) {
  throw new Error(`Next.js standalone server is missing from ${distDirectory}.`);
}

function copyDirectory(source, destination, required = true) {
  if (!existsSync(source)) {
    if (required) throw new Error(`Required standalone runtime asset is missing: ${source}`);
    return false;
  }
  mkdirSync(destination, { recursive: true });
  cpSync(source, destination, { recursive: true, force: true });
  return true;
}

copyDirectory(join(distributionRoot, 'static'), join(clientRuntimeRoot, distDirectory, 'static'));
const copiedPublicAssets = copyDirectory(
  join(clientRoot, 'public'),
  join(clientRuntimeRoot, 'public'),
  false,
);

// Contract validators resolve schemas relative to either their traced package
// or the runtime working directory. Preserve both safe lookup locations in the
// self-contained native artifact.
const schemaSource = join(workspaceRoot, 'packages', 'contracts', 'schemas');
copyDirectory(schemaSource, join(standaloneRoot, 'packages', 'contracts', 'schemas'));
copyDirectory(schemaSource, join(clientRuntimeRoot, 'packages', 'contracts', 'schemas'));

console.log(
  JSON.stringify({
    status: 'ok',
    artifact: 'next-standalone',
    distDirectory,
    publicAssets: copiedPublicAssets ? 'copied' : 'not-present',
    schemas: 'copied',
  }),
);
