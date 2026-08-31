import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

export const REUSABILITY_PROTECTED_TREES = [
  // Hash authored source, never mutable compiler/test caches under the workspace.
  'packages/engine/src',
  'packages/contracts/src',
  'packages/contracts/schemas',
  'apps/server/src',
  'apps/client/src',
  'apps/client/app',
] as const;

export interface ProtectedFileHash {
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
}

export interface ProtectedTreeHash {
  readonly path: string;
  readonly sha256: string;
  readonly files: readonly ProtectedFileHash[];
}

export interface ReusabilitySnapshot {
  readonly schemaVersion: 'p10-reusability-protected-tree.v1';
  readonly algorithm: 'sha256';
  readonly trees: readonly ProtectedTreeHash[];
  readonly combinedSha256: string;
}

export interface ConfigurationDifference {
  readonly operation: 'add' | 'remove' | 'replace';
  readonly path: string;
  readonly before?: unknown;
  readonly after?: unknown;
}

function jsonObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function jsonPointerSegment(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}

/** Deterministic, value-bearing JSON Pointer diff used as config-only P10 evidence. */
export function configurationDifferences(
  before: unknown,
  after: unknown,
): readonly ConfigurationDifference[] {
  const differences: ConfigurationDifference[] = [];
  function visit(left: unknown, right: unknown, path: string): void {
    if (Object.is(left, right)) return;
    if (Array.isArray(left) && Array.isArray(right)) {
      const maximum = Math.max(left.length, right.length);
      for (let index = 0; index < maximum; index += 1) {
        const childPath = `${path}/${index}`;
        if (index >= left.length)
          differences.push({ operation: 'add', path: childPath, after: right[index] });
        else if (index >= right.length)
          differences.push({ operation: 'remove', path: childPath, before: left[index] });
        else visit(left[index], right[index], childPath);
      }
      return;
    }
    if (jsonObject(left) && jsonObject(right)) {
      const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
      for (const key of keys) {
        const childPath = `${path}/${jsonPointerSegment(key)}`;
        if (!Object.hasOwn(left, key))
          differences.push({ operation: 'add', path: childPath, after: right[key] });
        else if (!Object.hasOwn(right, key))
          differences.push({ operation: 'remove', path: childPath, before: left[key] });
        else visit(left[key], right[key], childPath);
      }
      return;
    }
    differences.push({ operation: 'replace', path, before: left, after: right });
  }
  visit(before, after, '');
  return differences;
}

function slash(value: string): string {
  return value.replaceAll('\\', '/');
}

async function filesUnder(directory: string): Promise<readonly string[]> {
  const output: string[] = [];
  async function visit(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const target = resolve(current, entry.name);
      if (entry.isDirectory()) await visit(target);
      else if (entry.isFile()) output.push(target);
    }
  }
  await visit(directory);
  return output;
}

async function treeHash(workspaceRoot: string, tree: string): Promise<ProtectedTreeHash> {
  const absoluteTree = resolve(workspaceRoot, tree);
  const treeStat = await stat(absoluteTree);
  if (!treeStat.isDirectory() && !treeStat.isFile())
    throw new Error(`Reusability protected path is not a file or directory: ${tree}`);
  const files: ProtectedFileHash[] = [];
  for (const absoluteFile of treeStat.isFile() ? [absoluteTree] : await filesUnder(absoluteTree)) {
    const bytes = await readFile(absoluteFile);
    files.push({
      path: slash(relative(workspaceRoot, absoluteFile)),
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.byteLength,
    });
  }
  const canonical = files.map((file) => `${file.path}\0${file.bytes}\0${file.sha256}`).join('\n');
  return {
    path: slash(tree),
    sha256: createHash('sha256').update(canonical).digest('hex'),
    files,
  };
}

export async function snapshotProtectedTrees(
  workspaceRoot = resolve(__dirname, '..'),
): Promise<ReusabilitySnapshot> {
  const trees: ProtectedTreeHash[] = [];
  for (const tree of REUSABILITY_PROTECTED_TREES) trees.push(await treeHash(workspaceRoot, tree));
  return {
    schemaVersion: 'p10-reusability-protected-tree.v1',
    algorithm: 'sha256',
    trees,
    combinedSha256: createHash('sha256')
      .update(trees.map((tree) => `${tree.path}\0${tree.sha256}`).join('\n'))
      .digest('hex'),
  };
}

export function protectedTreeDifferences(
  before: ReusabilitySnapshot,
  after: ReusabilitySnapshot,
): readonly string[] {
  const differences: string[] = [];
  const beforeFiles = new Map(
    before.trees.flatMap((tree) => tree.files.map((file) => [file.path, file] as const)),
  );
  const afterFiles = new Map(
    after.trees.flatMap((tree) => tree.files.map((file) => [file.path, file] as const)),
  );
  for (const path of [...new Set([...beforeFiles.keys(), ...afterFiles.keys()])].sort()) {
    const left = beforeFiles.get(path);
    const right = afterFiles.get(path);
    if (!left) differences.push(`added:${path}`);
    else if (!right) differences.push(`removed:${path}`);
    else if (left.sha256 !== right.sha256 || left.bytes !== right.bytes)
      differences.push(`changed:${path}`);
  }
  return differences;
}

export function assertProtectedTreesUnchanged(
  before: ReusabilitySnapshot,
  after: ReusabilitySnapshot,
): void {
  const differences = protectedTreeDifferences(before, after);
  if (differences.length > 0) {
    throw new Error(
      `P10 Reusability Gate failed; protected implementation changed: ${differences.join(', ')}`,
    );
  }
  if (before.combinedSha256 !== after.combinedSha256) {
    throw new Error('P10 Reusability Gate failed; protected combined hash changed.');
  }
}

export async function writeSnapshot(path: string, snapshot: ReusabilitySnapshot): Promise<void> {
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
}

async function readSnapshot(path: string): Promise<ReusabilitySnapshot> {
  const value = JSON.parse(await readFile(path, 'utf8')) as ReusabilitySnapshot;
  if (
    value.schemaVersion !== 'p10-reusability-protected-tree.v1' ||
    value.algorithm !== 'sha256' ||
    !Array.isArray(value.trees)
  ) {
    throw new Error('The supplied P10 Reusability Gate snapshot is invalid.');
  }
  return value;
}

async function main(): Promise<void> {
  const [command, path] = process.argv.slice(2);
  if ((command !== 'snapshot' && command !== 'verify') || !path) {
    throw new Error('Use snapshot <output.json> or verify <baseline.json>.');
  }
  const current = await snapshotProtectedTrees();
  if (command === 'snapshot') {
    await writeSnapshot(resolve(path), current);
    console.log(JSON.stringify({ status: 'ok', action: 'snapshot', ...current }));
    return;
  }
  const baseline = await readSnapshot(resolve(path));
  assertProtectedTreesUnchanged(baseline, current);
  console.log(
    JSON.stringify({
      status: 'ok',
      action: 'verify',
      combinedSha256: current.combinedSha256,
      protectedTrees: REUSABILITY_PROTECTED_TREES,
      differences: [],
    }),
  );
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
