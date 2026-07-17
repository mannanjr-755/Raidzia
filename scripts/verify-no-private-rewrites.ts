/**
 * Fail the build if Next.js routes-manifest still proxies to a private host.
 * Prevents shipping DNS_HOSTNAME_RESOLVED_PRIVATE to Netlify/Vercel.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'apps/web/.next/routes-manifest.json');

const PRIVATE =
  /127\.0\.0\.1|localhost|0\.0\.0\.0|\.local(?:[:/"']|$)|\.internal(?:[:/"']|$)|https?:\/\/api(?::\d+)?(?:\/|"|')/i;

function main() {
  if (!fs.existsSync(MANIFEST)) {
    console.error('[verify-no-private-rewrites] Missing', MANIFEST);
    process.exit(1);
  }

  const text = fs.readFileSync(MANIFEST, 'utf8');
  const json = JSON.parse(text);
  const destinations: string[] = [];

  const collect = (arr: unknown) => {
    if (!Array.isArray(arr)) return;
    for (const item of arr) {
      if (item && typeof item === 'object' && 'destination' in item) {
        destinations.push(String((item as { destination: string }).destination));
      }
    }
  };

  collect(json.rewrites?.beforeFiles);
  collect(json.rewrites?.afterFiles);
  collect(json.rewrites?.fallback);
  if (Array.isArray(json.rewrites)) collect(json.rewrites);

  const bad = destinations.filter((d) => PRIVATE.test(d));

  if (bad.length > 0) {
    console.error('\n[verify-no-private-rewrites] FATAL: private rewrite destinations found:');
    for (const d of bad) console.error('  -', d);
    console.error(
      '\nThis causes DNS_HOSTNAME_RESOLVED_PRIVATE on Netlify/Vercel.\n' +
        'Set NEXT_PUBLIC_API_URL=https://your-public-api/api before building for CDN.\n' +
        'Or set ALLOW_PRIVATE_API_REWRITE=true only for same-host (Railway/Docker) builds.\n'
    );
    process.exit(1);
  }

  console.log('[verify-no-private-rewrites] OK — no private API rewrites in routes-manifest');
}

main();
