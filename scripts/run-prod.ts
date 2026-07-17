/**
 * Production process manager: starts Express API + Next.js web together.
 * Use after `npm run build`.
 *
 * Env:
 *   API_PORT (default 4000)
 *   WEB_PORT / PORT (default 3000; Railway sets PORT for public web)
 *   API_ORIGIN (default http://127.0.0.1:API_PORT)
 *   CORS_ORIGINS — comma-separated; web origin is always appended
 */
import { spawn, type ChildProcess } from 'child_process';
import http from 'http';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(args: string[], env: NodeJS.ProcessEnv = {}): ChildProcess {
  return spawn(npmBin, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...env },
  });
}

function waitForApiHealth(port: number, maxAttempts = 60): Promise<boolean> {
  return new Promise((resolve) => {
    let attempts = 0;

    const check = () => {
      attempts += 1;
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(true);
          return;
        }
        retry();
      });
      req.on('error', retry);
      req.setTimeout(2000, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (attempts >= maxAttempts) {
        resolve(false);
        return;
      }
      setTimeout(check, 500);
    };

    check();
  });
}

async function main() {
  const API_PORT = parseInt(process.env.API_PORT || '4000', 10);
  const WEB_PORT = parseInt(process.env.WEB_PORT || process.env.PORT || '3000', 10);
  const apiOrigin = process.env.API_ORIGIN || `http://127.0.0.1:${API_PORT}`;
  const webOrigin = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${WEB_PORT}`;

  const corsOrigins = [process.env.CORS_ORIGINS, webOrigin, `http://127.0.0.1:${WEB_PORT}`]
    .filter(Boolean)
    .join(',');

  console.log('Starting RSS ERP (production)');
  console.log(`  API  → http://0.0.0.0:${API_PORT}`);
  console.log(`  Web  → http://0.0.0.0:${WEB_PORT}`);
  console.log(`  Proxy API_ORIGIN=${apiOrigin}`);

  const api = run(['run', 'start', '--workspace=@rss/api'], {
    API_PORT: String(API_PORT),
    CORS_ORIGINS: corsOrigins,
    NODE_ENV: 'production',
  });

  const apiReady = await waitForApiHealth(API_PORT);
  if (!apiReady) {
    console.error('API failed health check — aborting web startup');
    api.kill();
    process.exit(1);
  }
  console.log('API health check passed');

  const web = run(['run', 'start', '--workspace=@rss/web', '--', '-H', '0.0.0.0', '-p', String(WEB_PORT)], {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '/api',
    PORT: String(WEB_PORT),
    HOSTNAME: '0.0.0.0',
    NODE_ENV: 'production',
  });

  const stopAll = (code = 0) => {
    api.kill();
    web.kill();
    process.exit(code);
  };

  api.on('exit', (code) => {
    console.error(`API process exited with code ${code ?? 0}`);
    stopAll(code ?? 1);
  });
  web.on('exit', (code) => {
    console.error(`Web process exited with code ${code ?? 0}`);
    stopAll(code ?? 1);
  });
  process.on('SIGINT', () => stopAll(0));
  process.on('SIGTERM', () => stopAll(0));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
