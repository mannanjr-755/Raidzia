import type { NextConfig } from 'next';

/**
 * API proxy rewrites — CRITICAL FOR CDN DEPLOYS
 *
 * Netlify/Vercel edge networks REJECT private destinations:
 *   DNS_HOSTNAME_RESOLVED_PRIVATE
 *
 * Rules:
 * 1. Absolute NEXT_PUBLIC_API_URL (https://…) → no rewrite (browser → API).
 * 2. Public API_ORIGIN (https://…) → rewrite /api → that origin.
 * 3. Private API_ORIGIN (127.0.0.1 / localhost / Docker DNS) → rewrite ONLY when
 *    ALLOW_PRIVATE_API_REWRITE=true (Railway/Render/Docker same-host).
 * 4. Default (no flag) → NO rewrite to private hosts. Ever.
 */

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
      h.endsWith('.internal') ||
      h.endsWith('.railway.internal')
    ) {
      return true;
    }
    // Docker Compose service names (e.g. "api")
    if (!h.includes('.')) return true;
    // RFC1918
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(h)) return true;
    return false;
  } catch {
    return true;
  }
}

function isCdnPlatform(): boolean {
  return (
    process.env.NETLIFY === 'true' ||
    process.env.VERCEL === '1' ||
    process.env.CF_PAGES === '1' ||
    process.env.SKIP_PRIVATE_API_REWRITE === 'true'
  );
}

const rawApiOrigin = (process.env.API_ORIGIN || '').trim().replace(/\/$/, '');
const publicApiUrl = (process.env.NEXT_PUBLIC_API_URL || '/api').trim().replace(/\/$/, '');
const allowPrivate = process.env.ALLOW_PRIVATE_API_REWRITE === 'true';
const onCdn = isCdnPlatform();

const usesDirectPublicApi =
  publicApiUrl.startsWith('https://') || publicApiUrl.startsWith('http://');

let rewriteDestination: string | null = null;

if (usesDirectPublicApi) {
  if (isPrivateHostname(publicApiUrl)) {
    throw new Error(
      `[next.config] NEXT_PUBLIC_API_URL is a private host (${publicApiUrl}). ` +
        'Use a public HTTPS URL, e.g. https://api.yourdomain.com/api'
    );
  }
  rewriteDestination = null;
  console.log(`[next.config] Direct public API → ${publicApiUrl} (no rewrite)`);
} else if (rawApiOrigin && !isPrivateHostname(rawApiOrigin)) {
  rewriteDestination = `${rawApiOrigin}/api/:path*`;
  console.log(`[next.config] Public rewrite → ${rewriteDestination}`);
} else if (rawApiOrigin && isPrivateHostname(rawApiOrigin)) {
  if (allowPrivate && !onCdn) {
    rewriteDestination = `${rawApiOrigin}/api/:path*`;
    console.log(`[next.config] Same-host private rewrite (allowed) → ${rewriteDestination}`);
  } else {
    // CDN or unset: never throw — skip rewrite so deploys do not embed private DNS.
    console.warn(
      `[next.config] Skipping private rewrite (${rawApiOrigin || 'default'}). ` +
        (onCdn
          ? 'CDN build: set NEXT_PUBLIC_API_URL=https://YOUR-PUBLIC-API/api'
          : 'Set ALLOW_PRIVATE_API_REWRITE=true for same-host deploys.')
    );
    rewriteDestination = null;
  }
} else if (allowPrivate && !onCdn) {
  rewriteDestination = 'http://127.0.0.1:4000/api/:path*';
  console.log(`[next.config] Default same-host rewrite → ${rewriteDestination}`);
} else {
  // Safe default: no private rewrite baked into the build.
  rewriteDestination = null;
  console.log(
    '[next.config] No /api rewrite. Set NEXT_PUBLIC_API_URL to a public HTTPS API, ' +
      'or ALLOW_PRIVATE_API_REWRITE=true for same-host deploys.'
  );
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [],
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    if (!rewriteDestination) return [];
    return [{ source: '/api/:path*', destination: rewriteDestination }];
  },
};

export default nextConfig;
