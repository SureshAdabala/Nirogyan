import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  assertProtectedTreesUnchanged,
  configurationDifferences,
  protectedTreeDifferences,
  snapshotProtectedTrees,
} from './p10-reusability-gate';

const temporaryDirectories: string[] = [];

async function fixtureWorkspace(): Promise<string> {
  const root = await mkdtemp(resolve(tmpdir(), 'niro-p10-gate-'));
  temporaryDirectories.push(root);
  for (const tree of [
    'packages/engine/src',
    'packages/contracts/src',
    'packages/contracts/schemas',
    'apps/server/src/modules',
    'apps/server/src/persistence',
    'apps/client/src/calculator',
    'apps/client/src/result',
    'apps/client/app',
  ]) {
    await mkdir(resolve(root, tree), { recursive: true });
    await writeFile(
      resolve(root, tree, 'fixture.ts'),
      `export const tree = ${JSON.stringify(tree)};`,
    );
  }
  await writeFile(resolve(root, 'apps/server/src/app.ts'), 'export const appArchitecture = true;');
  await mkdir(resolve(root, 'apps/client/src/admin'), { recursive: true });
  await writeFile(resolve(root, 'apps/client/src/api.ts'), 'export const publicApi = true;');
  await writeFile(resolve(root, 'apps/client/src/admin/api.ts'), 'export const adminApi = true;');
  return root;
}

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe('P10 protected implementation hash gate', () => {
  it('creates a deterministic value-bearing JSON Pointer configuration diff', () => {
    expect(
      configurationDifferences(
        { b: 2, list: [1, 2], nested: { keep: 1, remove: true }, 'a/b~c': 'old' },
        { a: 1, b: 3, list: [1, 4, 5], nested: { add: 'x', keep: 1 }, 'a/b~c': 'new' },
      ),
    ).toEqual([
      { operation: 'add', path: '/a', after: 1 },
      { operation: 'replace', path: '/a~1b~0c', before: 'old', after: 'new' },
      { operation: 'replace', path: '/b', before: 2, after: 3 },
      { operation: 'replace', path: '/list/1', before: 2, after: 4 },
      { operation: 'add', path: '/list/2', after: 5 },
      { operation: 'add', path: '/nested/add', after: 'x' },
      { operation: 'remove', path: '/nested/remove', before: true },
    ]);
  });

  it('is deterministic and accepts a byte-identical protected tree', async () => {
    const root = await fixtureWorkspace();
    const before = await snapshotProtectedTrees(root);
    const after = await snapshotProtectedTrees(root);
    expect(after).toEqual(before);
    expect(protectedTreeDifferences(before, after)).toEqual([]);
    expect(() => assertProtectedTreesUnchanged(before, after)).not.toThrow();
  });

  it('reports exact added, removed, and changed protected files', async () => {
    const root = await fixtureWorkspace();
    const before = await snapshotProtectedTrees(root);
    await writeFile(resolve(root, 'packages/engine/src/fixture.ts'), 'changed');
    await writeFile(resolve(root, 'apps/client/src/result/added.ts'), 'added');
    await rm(resolve(root, 'apps/client/src/calculator/fixture.ts'));
    const after = await snapshotProtectedTrees(root);
    expect(protectedTreeDifferences(before, after)).toEqual([
      'removed:apps/client/src/calculator/fixture.ts',
      'added:apps/client/src/result/added.ts',
      'changed:packages/engine/src/fixture.ts',
    ]);
    expect(() => assertProtectedTreesUnchanged(before, after)).toThrow(
      'protected implementation changed',
    );
  });
});
