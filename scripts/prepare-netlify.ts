/**
 * Prepare Netlify / CDN frontend builds.
 *
 * Netlify cannot run Express and cannot proxy to private IPs (127.0.0.1).
 * That produces: DNS_HOSTNAME_RESOLVED_PRIVATE
 *
 * Required before build (set in Netlify UI → Environment variables):
 *   NEXT_PUBLIC_API_URL=https://your-public-api.example.com/api
 *   OR
 *   API_ORIGIN=https://your-public-api.example.com
 *
 * Prefer NEXT_PUBLIC_API_URL (browser → API directly; simplest and most reliable).
 * When using relative /api + public API_ORIGIN, write Netlify _redirects proxy.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const REDIRECTS_PATH = path.join(ROOT, 'apps/web/public/_redirects');

function isPrivateHostname(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      return true;
    }
    if (!hostname.includes('.')) return true;
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(hostname)) return true;
    return false;
  } catch {
    return true;
  }
}

function clearRedirects() {
  if (fs.existsSync(REDIRECTS_PATH)) {
    fs.unlinkSync(REDIRECTS_PATH);
  }
}

function fail(message: string): never {
  console.error('\n[prepare-netlify] FATAL: ' + message + '\n');
  process.exit(1);
}

function main() {
  const apiOrigin = (process.env.API_ORIGIN || '').replace(/\/$/, '');
  const publicApiUrl = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/$/, '');

  // Mark CDN so next.config.ts skips private rewrites.
  process.env.NETLIFY = process.env.NETLIFY || 'true';
  process.env.SKIP_PRIVATE_API_REWRITE = 'true';

  // Preferred: absolute public API URL — browser calls API directly (CORS required).
  if (publicApiUrl.startsWith('https://') || publicApiUrl.startsWith('http://')) {
    if (isPrivateHostname(publicApiUrl)) {
      fail(
        `NEXT_PUBLIC_API_URL points to a private host (${publicApiUrl}). ` +
          'Use a public HTTPS API URL, e.g. https://api.yourdomain.com/api'
      );
    }
    clearRedirects();
    console.log(`[prepare-netlify] Direct public API: ${publicApiUrl}`);
    console.log('[prepare-netlify] Ensure API CORS_ORIGINS includes your Netlify site URL.');
    return;
  }

  // Proxy mode: relative /api + public API_ORIGIN
  if (apiOrigin) {
    if (isPrivateHostname(apiOrigin)) {
      fail(
        `API_ORIGIN is private (${apiOrigin}). Netlify cannot proxy to localhost/127.0.0.1 ` +
          '(DNS_HOSTNAME_RESOLVED_PRIVATE). Set API_ORIGIN=https://your-public-api.example.com ' +
          'or NEXT_PUBLIC_API_URL=https://your-public-api.example.com/api'
      );
    }

    const redirects = `/api/*  ${apiOrigin}/api/:splat  200\n`;
    fs.mkdirSync(path.dirname(REDIRECTS_PATH), { recursive: true });
    fs.writeFileSync(REDIRECTS_PATH, redirects, 'utf8');
    console.log(`[prepare-netlify] Wrote _redirects: /api/* → ${apiOrigin}/api/:splat`);
    return;
  }

  fail(
    'No public API configured for Netlify.\n' +
      '  Set NEXT_PUBLIC_API_URL=https://your-api.example.com/api\n' +
      '  OR API_ORIGIN=https://your-api.example.com\n' +
      '  Deploy the Express API separately (Railway/Render/VPS), then set CORS_ORIGINS to your Netlify URL.'
  );
}

main();
