import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { spawnWithEvidence } from './child-process-evidence';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directory) => {
      await rm(directory, { recursive: true, force: true });
    }),
  );
});

describe('child process evidence capture', () => {
  it('mirrors and durably separates stdout and stderr', async () => {
    const evidenceDirectory = await mkdtemp(resolve(tmpdir(), 'p10-child-evidence-'));
    temporaryDirectories.push(evidenceDirectory);
    await mkdir(resolve(evidenceDirectory, 'logs'));
    const logged = spawnWithEvidence({
      command: process.execPath,
      arguments: [
        '-e',
        "process.stdout.write('captured stdout'); process.stderr.write('captured stderr');",
      ],
      cwd: evidenceDirectory,
      environment: process.env,
      evidenceDirectory,
      label: 'fixture',
    });
    const exitCode = await new Promise<number | null>((resolveExit, reject) => {
      logged.child.once('error', reject);
      logged.child.once('exit', resolveExit);
    });
    await logged.logsFlushed;

    expect(exitCode).toBe(0);
    await expect(readFile(resolve(evidenceDirectory, logged.stdoutArtifact), 'utf8')).resolves.toBe(
      'captured stdout',
    );
    await expect(readFile(resolve(evidenceDirectory, logged.stderrArtifact), 'utf8')).resolves.toBe(
      'captured stderr',
    );
  });
});
