/**
 * CDN (Netlify/Vercel) frontend build orchestrator.
 *
 * 1. Validates public API URL (rejects 127.0.0.1 / localhost)
 * 2. Spawns web build with private rewrites DISABLED
 * 3. Verifies routes-manifest has no private destinations
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const REDIRECTS_PATH = path.join(ROOT, 'apps/web/public/_redirects');
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function isPrivateHostname(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    const h = hostname.toLowerCase();
    if (
      h === 'localhost' ||
      h === '127.0.0.1' ||
      h === '0.0.0.0' ||
      h === '::1' ||
      h.endsWith('.local') ||
      h.endsWith('.internal')
    ) {
      return true;
    }
    if (!h.includes('.')) return true;
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(h)) return true;
    return false;
  } catch {
    return true;
  }
}

function fail(message: string): never {
  console.error('\n[build-cdn] FATAL: ' + message + '\n');
  process.exit(1);
}

function clearRedirects() {
  if (fs.existsSync(REDIRECTS_PATH)) fs.unlinkSync(REDIRECTS_PATH);
}

function main() {
  const apiOrigin = (process.env.API_ORIGIN || '').trim().replace(/\/$/, '');
  let publicApiUrl = (process.env.NEXT_PUBLIC_API_URL || '/api').trim().replace(/\/$/, '');

  // Strip private API_ORIGIN from the child env so Next never sees it.
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    NETLIFY: process.env.NETLIFY || 'true',
    SKIP_PRIVATE_API_REWRITE: 'true',
    ALLOW_PRIVATE_API_REWRITE: 'false',
  };

  // Preferred: absolute public API
  if (publicApiUrl.startsWith('https://') || publicApiUrl.startsWith('http://')) {
    if (isPrivateHostname(publicApiUrl)) {
      fail(`NEXT_PUBLIC_API_URL is private (${publicApiUrl}). Use https://your-api.example.com/api`);
    }
    clearRedirects();
    // Block apps/web/.env.local from injecting API_ORIGIN=127.0.0.1
    // (Next.js only skips .env keys that already exist on process.env)
    childEnv.API_ORIGIN = '';
    childEnv.ALLOW_PRIVATE_API_REWRITE = 'false';
    childEnv.SKIP_PRIVATE_API_REWRITE = 'true';
    childEnv.NEXT_PUBLIC_API_URL = publicApiUrl;
    console.log(`[build-cdn] Direct public API: ${publicApiUrl}`);
  } else if (apiOrigin && !isPrivateHostname(apiOrigin)) {
    // Proxy via Netlify _redirects to public origin; keep relative NEXT_PUBLIC_API_URL=/api
    const redirects = `/api/*  ${apiOrigin}/api/:splat  200\n`;
    fs.mkdirSync(path.dirname(REDIRECTS_PATH), { recursive: true });
    fs.writeFileSync(REDIRECTS_PATH, redirects, 'utf8');
    childEnv.API_ORIGIN = apiOrigin;
    childEnv.NEXT_PUBLIC_API_URL = publicApiUrl || '/api';
    childEnv.ALLOW_PRIVATE_API_REWRITE = 'false';
    console.log(`[build-cdn] Public proxy: /api → ${apiOrigin}`);
  } else if (apiOrigin && isPrivateHostname(apiOrigin)) {
    fail(
      `API_ORIGIN is private (${apiOrigin}). Netlify cannot reach 127.0.0.1 ` +
        '(DNS_HOSTNAME_RESOLVED_PRIVATE).\n' +
        '  Set NEXT_PUBLIC_API_URL=https://YOUR-PUBLIC-API/api in Netlify environment variables.'
    );
  } else {
    fail(
      'No public API configured for CDN deploy.\n' +
        '  In Netlify → Site settings → Environment variables, set:\n' +
        '    NEXT_PUBLIC_API_URL=https://YOUR-PUBLIC-API.example.com/api\n' +
        '  Deploy the Express API on Railway/Render/VPS first, then paste its public HTTPS URL.'
    );
  }

  console.log('[build-cdn] Building shared + web (private rewrites disabled)…');

  const shared = spawnSync(npmBin, ['run', 'build', '--workspace=@rss/shared'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
    env: childEnv,
  });
  if (shared.status !== 0) process.exit(shared.status ?? 1);

  const web = spawnSync(npmBin, ['run', 'build', '--workspace=@rss/web'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
    env: childEnv,
  });
  if (web.status !== 0) process.exit(web.status ?? 1);

  const verify = spawnSync(npmBin, ['exec', '--', 'tsx', 'scripts/verify-no-private-rewrites.ts'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
    env: childEnv,
  });
  if (verify.status !== 0) process.exit(verify.status ?? 1);

  console.log('[build-cdn] Success — safe for Netlify/Vercel');
}

main();
