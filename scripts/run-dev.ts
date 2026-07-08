import { spawn } from 'child_process';
import { spawnSync } from 'child_process';
import net from 'net';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const POSTGRES_PORT = 5433;
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
let postgresProcess: ReturnType<typeof spawn> | null = null;

function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port, timeout: 2000 });
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function waitForPort(port: number, label: string, maxAttempts = 120): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    if (await isPortOpen(port)) {
      console.log(`${label} ready on port ${port}`);
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${label} did not become ready on port ${port}`);
}

async function findFreePort(startPort: number, maxAttempts = 20): Promise<number> {
  for (let port = startPort; port < startPort + maxAttempts; port++) {
    if (!(await isPortOpen(port))) return port;
  }
  throw new Error(`No free port found from ${startPort} to ${startPort + maxAttempts - 1}`);
}

function run(command: string, args: string[], options: { detached?: boolean; env?: NodeJS.ProcessEnv } = {}) {
  return spawn(command, args, {
    cwd: ROOT,
    stdio: options.detached ? 'ignore' : 'inherit',
    shell: true,
    detached: options.detached,
    env: { ...process.env, ...options.env },
  });
}

function runSync(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed`);
  }
}

async function main() {
  if (!(await isPortOpen(POSTGRES_PORT))) {
    console.log('Starting embedded PostgreSQL...');
    postgresProcess = run(npxBin, ['tsx', 'scripts/start-postgres.ts']);
    await waitForPort(POSTGRES_PORT, 'PostgreSQL');
  } else {
    console.log(`PostgreSQL already running on port ${POSTGRES_PORT}`);
  }

  console.log('Preparing database...');
  runSync(npxBin, ['tsx', 'scripts/ensure-db.ts']);

  const webPort = await findFreePort(3000);
  const webOrigin = `http://localhost:${webPort}`;
  if (webPort !== 3000) {
    console.log(`Port 3000 is in use. Starting web on ${webOrigin}`);
  }
  console.log('Starting API and web servers...');

  const corsOrigins = [
    process.env.CORS_ORIGINS,
    webOrigin,
    `http://127.0.0.1:${webPort}`,
  ].filter(Boolean).join(',');

  const api = run(npmBin, ['run', 'dev', '--workspace=@rss/api'], { env: { CORS_ORIGINS: corsOrigins } });
  const web = run(npmBin, ['run', 'dev', '--workspace=@rss/web', '--', '-p', String(webPort)]);

  const stopAll = (code = 0) => {
    api.kill();
    web.kill();
    postgresProcess?.kill();
    process.exit(code);
  };

  api.on('exit', (code) => stopAll(code ?? 0));
  web.on('exit', (code) => stopAll(code ?? 0));
  process.on('SIGINT', () => stopAll(0));
  process.on('SIGTERM', () => stopAll(0));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
