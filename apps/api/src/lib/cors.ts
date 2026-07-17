/**
 * CORS origin allowlist for the Express API.
 *
 * Dev: allow any http(s)://localhost:* and http(s)://127.0.0.1:* by default
 *      (Next may run on 3000, 3001, 3002… and forwards Origin through rewrites).
 * Prod: allow CORS_ORIGINS + NEXT_PUBLIC_APP_URL (+ optional deploy-preview hosts).
 */
export function getConfiguredOrigins(): string[] {
  return (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function isLocalDevHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function isDeployPreviewHost(hostname: string): boolean {
  return (
    hostname.endsWith('.netlify.app') ||
    hostname.endsWith('.vercel.app') ||
    hostname.endsWith('.onrender.com') ||
    hostname.endsWith('.up.railway.app')
  );
}

export function isOriginAllowed(origin: string | undefined): boolean {
  // Non-browser clients (curl, server-side, same-origin without Origin header)
  if (!origin) return true;

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  const normalized = origin.replace(/\/$/, '');
  const allowed = getConfiguredOrigins();

  if (allowed.includes('*')) return true;
  if (allowed.includes(normalized) || allowed.includes(origin)) return true;

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/$/, '');
  if (appUrl && (normalized === appUrl || origin === appUrl)) return true;

  const allowLocalhost =
    process.env.NODE_ENV !== 'production' ||
    process.env.CORS_ALLOW_LOCALHOST === 'true' ||
    process.env.CORS_ALLOW_LOCALHOST === '1';

  if (allowLocalhost && isLocalDevHost(url.hostname)) {
    return url.protocol === 'http:' || url.protocol === 'https:';
  }

  // Explicit opt-in for Netlify/Vercel preview URLs (useful during staging)
  if (process.env.CORS_ALLOW_DEPLOY_PREVIEWS === 'true' || process.env.CORS_ALLOW_DEPLOY_PREVIEWS === '1') {
    if (isDeployPreviewHost(url.hostname) && url.protocol === 'https:') {
      return true;
    }
  }

  return false;
}

export function corsOriginDelegate(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
): void {
  if (isOriginAllowed(origin)) {
    callback(null, true);
    return;
  }
  callback(new Error(`CORS blocked origin: ${origin}`));
}
