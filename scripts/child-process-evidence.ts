import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import { finished } from 'node:stream/promises';

export interface EvidenceChildProcess {
  readonly child: ChildProcess;
  readonly label: string;
  readonly stdoutArtifact: string;
  readonly stderrArtifact: string;
  readonly logsFlushed: Promise<void>;
}

export interface EvidenceChildProcessOptions {
  readonly command: string;
  readonly arguments: readonly string[];
  readonly cwd: string;
  readonly environment: NodeJS.ProcessEnv;
  readonly evidenceDirectory: string;
  readonly label: string;
  readonly spawnOptions?: Pick<SpawnOptions, 'windowsHide'>;
}

/**
 * Spawn a child with stdout/stderr mirrored to the invoking console and durable
 * per-stream evidence files. The returned promise resolves only after both log
 * files have been closed and flushed by Node's streams layer.
 */
export function spawnWithEvidence(options: EvidenceChildProcessOptions): EvidenceChildProcess {
  const stdoutArtifact = `logs/${options.label}.stdout.log`;
  const stderrArtifact = `logs/${options.label}.stderr.log`;
  const stdoutLog = createWriteStream(resolve(options.evidenceDirectory, stdoutArtifact), {
    flags: 'wx',
  });
  const stderrLog = createWriteStream(resolve(options.evidenceDirectory, stderrArtifact), {
    flags: 'wx',
  });
  const child = spawn(options.command, [...options.arguments], {
    cwd: options.cwd,
    env: options.environment,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: options.spawnOptions?.windowsHide ?? true,
  });
  if (!child.stdout || !child.stderr) {
    stdoutLog.destroy();
    stderrLog.destroy();
    throw new Error(`Could not capture ${options.label} child output.`);
  }

  child.stdout.pipe(process.stdout, { end: false });
  child.stderr.pipe(process.stderr, { end: false });
  child.stdout.pipe(stdoutLog);
  child.stderr.pipe(stderrLog);

  const logsFlushed = Promise.all([finished(stdoutLog), finished(stderrLog)]).then(() => undefined);
  // Register a handler immediately so an early filesystem failure is retained
  // for the orchestrator without becoming an unhandled rejection first.
  void logsFlushed.catch(() => undefined);
  return {
    child,
    label: options.label,
    stdoutArtifact,
    stderrArtifact,
    logsFlushed,
  };
}
