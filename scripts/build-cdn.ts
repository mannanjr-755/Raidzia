/**
 * CDN (Netlify/Vercel) frontend build — always succeeds without private DNS rewrites.
 *
 * Rules:
 * - NEVER rewrite /api to 127.0.0.1/localhost (DNS_HOSTNAME_RESOLVED_PRIVATE)
 * - If NEXT_PUBLIC_API_URL is a public https URL → bake it in (browser → API)
 * - If API_ORIGIN is a public https URL → optional Netlify _redirects proxy
 * - If only private/missing API config → still build (no rewrite); UI shows config help
 * - Always verify routes-manifest has no private destinations
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

function clearRedirects() {
  if (fs.existsSync(REDIRECTS_PATH)) fs.unlinkSync(REDIRECTS_PATH);
}

function main() {
  const apiOrigin = (process.env.API_ORIGIN || '').trim().replace(/\/$/, '');
  const publicApiUrl = (process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/$/, '');

  const onVercel = process.env.VERCEL === '1';
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    // Mark as CDN so next.config never embeds private rewrites
    ...(onVercel ? { VERCEL: '1' } : { NETLIFY: 'true' }),
    SKIP_PRIVATE_API_REWRITE: 'true',
    ALLOW_PRIVATE_API_REWRITE: 'false',
    SKIP_PRISMA_GENERATE: 'true',
    // Block apps/web/.env.local from injecting private API_ORIGIN
    API_ORIGIN: '',
  };

  clearRedirects();

  if (publicApiUrl.startsWith('https://') || publicApiUrl.startsWith('http://')) {
    if (isPrivateHostname(publicApiUrl)) {
      console.error(
        `\n[build-cdn] FATAL: NEXT_PUBLIC_API_URL is private (${publicApiUrl}).\n` +
          '  Use a public HTTPS URL, e.g. https://your-api.onrender.com/api\n'
      );
      process.exit(1);
    }
    childEnv.NEXT_PUBLIC_API_URL = publicApiUrl;
    console.log(`[build-cdn] Public API (direct): ${publicApiUrl}`);
  } else if (apiOrigin && !isPrivateHostname(apiOrigin)) {
    const redirects = `/api/*  ${apiOrigin}/api/:splat  200\n`;
    fs.mkdirSync(path.dirname(REDIRECTS_PATH), { recursive: true });
    fs.writeFileSync(REDIRECTS_PATH, redirects, 'utf8');
    childEnv.API_ORIGIN = apiOrigin;
    childEnv.NEXT_PUBLIC_API_URL = publicApiUrl || '/api';
    console.log(`[build-cdn] Public API (proxy): /api → ${apiOrigin}`);
  } else {
    // Deploy still succeeds — pages load; API calls show a config message until env is set.
    childEnv.NEXT_PUBLIC_API_URL = '';
    childEnv.NEXT_PUBLIC_API_UNCONFIGURED = '1';
    if (apiOrigin && isPrivateHostname(apiOrigin)) {
      console.warn(
        `[build-cdn] Ignoring private API_ORIGIN (${apiOrigin}) — would cause DNS_HOSTNAME_RESOLVED_PRIVATE`
      );
    }
    console.warn(
      '[build-cdn] No public API URL set. Site will deploy, but login/API will not work until you set:\n' +
        '  NEXT_PUBLIC_API_URL=https://YOUR-PUBLIC-API/api\n' +
        '  Then redeploy. Also set CORS_ORIGINS on the API host to your Netlify/Vercel URL.'
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

  console.log('[build-cdn] Success — safe for Netlify/Vercel (no private DNS rewrites)');
}

main();
