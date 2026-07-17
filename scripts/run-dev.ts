import { spawn, type ChildProcess } from 'child_process';
import { spawnSync } from 'child_process';
import http from 'http';
import net from 'net';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const POSTGRES_PORT = 5433;
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
let postgresProcess: ChildProcess | null = null;
let shuttingDown = false;

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

function isApiHealthy(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
      let body = '';
      res.on('data', (c) => {
        body += c;
      });
      res.on('end', () => {
        resolve(
          !!res.statusCode &&
            res.statusCode >= 200 &&
            res.statusCode < 500 &&
            (body.includes('RSS ERP') || body.includes('success'))
        );
      });
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2500, () => {
      req.destroy();
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

async function findFreePort(startPort: number, maxAttempts = 30): Promise<number> {
  for (let port = startPort; port < startPort + maxAttempts; port++) {
    if (!(await isPortOpen(port))) return port;
  }
  throw new Error(`No free port found from ${startPort}`);
}

function run(
  command: string,
  args: string[],
  options: { detached?: boolean; env?: NodeJS.ProcessEnv } = {}
): ChildProcess {
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

async function resolveApiPort(preferred: number): Promise<{ port: number; reuse: boolean }> {
  if (!(await isPortOpen(preferred))) {
    return { port: preferred, reuse: false };
  }

  if (await isApiHealthy(preferred)) {
    console.log(`API already healthy on port ${preferred} — reusing it.`);
    return { port: preferred, reuse: true };
  }

  const next = await findFreePort(preferred + 1);
  console.log(`Port ${preferred} is busy. Starting API on port ${next}.`);
  return { port: next, reuse: false };
}

async function main() {
  const preferredApiPort = parseInt(process.env.API_PORT || '4000', 10);

  // Local same-host rewrites; clear leftover CDN flags from prior shells.
  const baseEnv: NodeJS.ProcessEnv = {
    ALLOW_PRIVATE_API_REWRITE: 'true',
    SKIP_PRIVATE_API_REWRITE: '',
    NETLIFY: '',
    VERCEL: '',
    CF_PAGES: '',
  };

  if (!(await isPortOpen(POSTGRES_PORT))) {
    console.log('Starting embedded PostgreSQL...');
    postgresProcess = run(npxBin, ['tsx', 'scripts/start-postgres.ts']);
    await waitForPort(POSTGRES_PORT, 'PostgreSQL');
  } else {
    console.log(`PostgreSQL already running on port ${POSTGRES_PORT}`);
  }

  console.log('Preparing database...');
  runSync(npxBin, ['tsx', 'scripts/ensure-db.ts']);

  // Re-check API port AFTER ensure-db (Prisma generate can bounce a running API).
  const { port: API_PORT, reuse: reuseApi } = await resolveApiPort(preferredApiPort);

  const webPort = await findFreePort(3000);
  const webOrigin = `http://localhost:${webPort}`;
  if (webPort !== 3000) {
    console.log(`Port 3000 is in use. Starting web on ${webOrigin}`);
  }

  const corsOrigins = [process.env.CORS_ORIGINS, webOrigin, `http://127.0.0.1:${webPort}`]
    .filter(Boolean)
    .join(',');

  const children: ChildProcess[] = [];

  console.log('Starting servers...');

  if (!reuseApi) {
    // Final race check
    if (await isPortOpen(API_PORT)) {
      if (await isApiHealthy(API_PORT)) {
        console.log(`API became healthy on ${API_PORT} — reusing instead of starting another.`);
      } else {
        const alt = await findFreePort(API_PORT + 1);
        console.log(`Port ${API_PORT} still busy. Using API port ${alt}.`);
        const api = run(npmBin, ['run', 'dev', '--workspace=@rss/api'], {
          env: {
            ...baseEnv,
            API_PORT: String(alt),
            CORS_ORIGINS: corsOrigins,
          },
        });
        children.push(api);
        await startWeb(children, webPort, webOrigin, alt, corsOrigins, baseEnv);
        return;
      }
    } else {
      const api = run(npmBin, ['run', 'dev', '--workspace=@rss/api'], {
        env: {
          ...baseEnv,
          API_PORT: String(API_PORT),
          CORS_ORIGINS: corsOrigins,
        },
      });
      children.push(api);
    }
  }

  await startWeb(children, webPort, webOrigin, API_PORT, corsOrigins, baseEnv);
}

async function startWeb(
  children: ChildProcess[],
  webPort: number,
  webOrigin: string,
  apiPort: number,
  _corsOrigins: string,
  baseEnv: NodeJS.ProcessEnv
) {
  const web = run(npmBin, ['run', 'dev', '--workspace=@rss/web', '--', '-p', String(webPort)], {
    env: {
      ...baseEnv,
      API_ORIGIN: `http://127.0.0.1:${apiPort}`,
      NEXT_PUBLIC_API_URL: '/api',
      ALLOW_PRIVATE_API_REWRITE: 'true',
      NEXT_PUBLIC_API_UNCONFIGURED: '',
    },
  });
  children.push(web);

  console.log(`\nRSS ERP dev ready:`);
  console.log(`  Web  → ${webOrigin}`);
  console.log(`  API  → http://localhost:${apiPort}`);
  console.log(`  Open ${webOrigin} in your browser.\n`);

  const stopAll = (code = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const child of children) {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
    }
    try {
      postgresProcess?.kill();
    } catch {
      /* ignore */
    }
    process.exit(code);
  };

  for (const child of children) {
    child.on('exit', (code, signal) => {
      if (shuttingDown) return;
      // Ignore clean exits; only tear down on unexpected failure of the web server.
      if (child === web && code && code !== 0) {
        console.error(`Web process exited with code ${code}${signal ? ` signal ${signal}` : ''}`);
        stopAll(code);
      } else if (child !== web && code && code !== 0) {
        console.warn(
          `API process exited with code ${code}. Web may still work if another API is on the same port.`
        );
      }
    });
  }

  process.on('SIGINT', () => stopAll(0));
  process.on('SIGTERM', () => stopAll(0));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
