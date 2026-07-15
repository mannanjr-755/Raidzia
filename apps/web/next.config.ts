import type { NextConfig } from 'next';

/**
 * Next.js rewrites are evaluated at build time.
 * Set API_ORIGIN before `next build`:
 *   - Local / single-host Docker: http://127.0.0.1:4000
 *   - Docker Compose (web + api services): http://api:4000
 *   - Split hosting (e.g. Vercel web + VPS API): https://api.yourdomain.com
 */
const apiOrigin = (process.env.API_ORIGIN || 'http://127.0.0.1:4000').replace(/\/$/, '');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [],
  eslint: {
    // Monorepo: ESLint lives at the repo root; skip blocking production builds.
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
