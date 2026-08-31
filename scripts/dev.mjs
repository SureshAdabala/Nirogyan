import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const rootEnvironmentPath = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(rootEnvironmentPath)) process.loadEnvFile(rootEnvironmentPath);

const isWindows = process.platform === 'win32';
const npmExecPath = process.env.npm_execpath;
const useNpmCli = isWindows && typeof npmExecPath === 'string' && npmExecPath.length > 0;
const npmCommand = useNpmCli ? process.execPath : isWindows ? 'npm.cmd' : 'npm';
const npmPrefixArgs = useNpmCli ? [npmExecPath] : [];
const processes = [
  ['server', '@niro/server'],
  ['client', '@niro/client'],
].map(([name, workspace]) => {
  const childEnvironment = { ...process.env };
  if (name === 'client') {
    childEnvironment.PORT = process.env.CLIENT_PORT ?? '3000';
  }
  const child = spawn(npmCommand, [...npmPrefixArgs, 'run', 'dev', '--workspace', workspace], {
    stdio: 'inherit',
    shell: isWindows && !useNpmCli,
    env: childEnvironment,
  });

  child.on('error', (error) => {
    console.error(`[${name}] failed to start`, error);
  });

  child.on('exit', (code, signal) => {
    if (code !== null && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
    } else if (signal !== null) {
      console.error(`[${name}] exited from signal ${signal}`);
    }
  });

  return child;
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; stopping workspace processes`);
  for (const child of processes) {
    child.kill('SIGTERM');
  }
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
