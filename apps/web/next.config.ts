import type { NextConfig } from 'next';

/**
 * Next.js rewrites are baked in at build time.
 *
 * CDN platforms (Netlify / Vercel) MUST NOT rewrite to private hosts
 * (127.0.0.1, localhost, Docker DNS names). That causes:
 *   DNS_HOSTNAME_RESOLVED_PRIVATE
 *
 * Strategies:
 *   1. Same-host Node (Railway/Render/Docker): API_ORIGIN=http://127.0.0.1:4000
 *      — rewrites are safe because Next and Express share the machine.
 *   2. CDN frontend + separate API: set NEXT_PUBLIC_API_URL=https://api.example.com/api
 *      — browser calls the public API directly; no rewrite needed.
 *   3. CDN frontend + public proxy: set API_ORIGIN=https://api.example.com
 *      — rewrite /api → public HTTPS origin only.
 */

function isPrivateHostname(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.railway.internal')
    ) {
      return true;
    }
    // Docker Compose service names / single-label hostnames (e.g. "api")
    if (!hostname.includes('.') && hostname !== 'localhost') {
      return true;
    }
    // RFC1918 private IPv4
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(hostname)) {
      return true;
    }
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

const rawApiOrigin = (process.env.API_ORIGIN || '').replace(/\/$/, '');
const publicApiUrl = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/$/, '');
const onCdn = isCdnPlatform();

// Prefer explicit public API URL for browser → API (no edge rewrite).
const usesDirectPublicApi =
  publicApiUrl.startsWith('https://') || publicApiUrl.startsWith('http://');

let rewriteDestination: string | null = null;

if (usesDirectPublicApi) {
  // Browser talks to the API host directly — skip Next rewrites.
  rewriteDestination = null;
  console.log(`[next.config] Direct public API: ${publicApiUrl} (no /api rewrite)`);
} else if (rawApiOrigin && !isPrivateHostname(rawApiOrigin)) {
  // Public HTTPS/HTTP origin — safe to rewrite from CDN or same-host.
  rewriteDestination = `${rawApiOrigin}/api/:path*`;
  console.log(`[next.config] Public API rewrite: /api/:path* → ${rewriteDestination}`);
} else if (rawApiOrigin && isPrivateHostname(rawApiOrigin) && !onCdn) {
  // Same-host Node deploy only (Railway / Render / Docker / VPS).
  rewriteDestination = `${rawApiOrigin}/api/:path*`;
  console.log(`[next.config] Same-host rewrite: /api/:path* → ${rewriteDestination}`);
} else if (onCdn) {
  // CDN with private/missing API_ORIGIN — fail loudly at build time.
  const message = [
    'CDN deploy detected (Netlify/Vercel) but no public API URL is configured.',
    'This causes DNS_HOSTNAME_RESOLVED_PRIVATE when rewriting to 127.0.0.1/localhost.',
    '',
    'Fix — set ONE of these in your hosting environment before build:',
    '  NEXT_PUBLIC_API_URL=https://your-api.example.com/api',
    '  API_ORIGIN=https://your-api.example.com',
    '',
    'Also set CORS_ORIGINS on the API to your frontend URL.',
  ].join('\n');
  console.error(`[next.config] ${message}`);
  throw new Error(message);
} else {
  // Local / same-host default.
  const fallback = 'http://127.0.0.1:4000';
  rewriteDestination = `${fallback}/api/:path*`;
  console.log(`[next.config] Default local rewrite: /api/:path* → ${rewriteDestination}`);
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [],
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    if (!rewriteDestination) {
      return [];
    }
    return [
      {
        source: '/api/:path*',
        destination: rewriteDestination,
      },
    ];
  },
};

export default nextConfig;
