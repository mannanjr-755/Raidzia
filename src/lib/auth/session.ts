import { createHmac, timingSafeEqual } from 'crypto';
import type { SessionData, AuthUser } from '@/types/auth';
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  SESSION_REMEMBER_MAX_AGE,
} from '@/lib/constants/auth';

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET must be set in production');
  }
  return secret || 'dev-session-secret-change-in-production';
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

export function encodeSession(session: SessionData): string {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(token: string): SessionData | null {
  try {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;

    const expected = sign(payload);
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const session = JSON.parse(Buffer.from(payload, 'base64url').toString()) as SessionData;
    if (session.expiresAt < Date.now()) return null;

    return session;
  } catch {
    return null;
  }
}

export function buildSession(user: AuthUser, rememberMe: boolean): SessionData {
  const maxAge = rememberMe ? SESSION_REMEMBER_MAX_AGE : SESSION_MAX_AGE;
  const now = Date.now();
  return {
    user,
    rememberMe,
    createdAt: now,
    expiresAt: now + maxAge * 1000,
  };
}

export function getSessionMaxAge(rememberMe: boolean): number {
  return rememberMe ? SESSION_REMEMBER_MAX_AGE : SESSION_MAX_AGE;
}

export { SESSION_COOKIE };
