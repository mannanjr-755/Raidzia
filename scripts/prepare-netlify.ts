/**
 * Prepare Netlify deployment artifacts before building apps/web.
 *
 * When API_ORIGIN points to an external host (not localhost), writes
 * apps/web/public/_redirects so /api/* is proxied to the backend.
 * This keeps NEXT_PUBLIC_API_URL=/api working on Netlify without running Express.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const REDIRECTS_PATH = path.join(ROOT, 'apps/web/public/_redirects');

function isLocalHost(url: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(url);
}

function main() {
  const apiOrigin = (process.env.API_ORIGIN || '').replace(/\/$/, '');
  const publicApiUrl = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/$/, '');

  // Direct absolute API URL — browser calls backend directly (CORS required on API)
  if (publicApiUrl.startsWith('http://') || publicApiUrl.startsWith('https://')) {
    if (fs.existsSync(REDIRECTS_PATH)) {
      fs.unlinkSync(REDIRECTS_PATH);
    }
    console.log(`Netlify: using direct API URL ${publicApiUrl} (no _redirects proxy)`);
    return;
  }

  if (!apiOrigin || isLocalHost(apiOrigin)) {
    if (fs.existsSync(REDIRECTS_PATH)) {
      fs.unlinkSync(REDIRECTS_PATH);
    }
    console.log('Netlify: local API_ORIGIN — skipping _redirects (use same-host or set external API_ORIGIN)');
    return;
  }

  const redirects = `/api/*  ${apiOrigin}/api/:splat  200\n`;
  fs.mkdirSync(path.dirname(REDIRECTS_PATH), { recursive: true });
  fs.writeFileSync(REDIRECTS_PATH, redirects, 'utf8');
  console.log(`Netlify: wrote _redirects proxy → ${apiOrigin}/api/*`);
}

main();
