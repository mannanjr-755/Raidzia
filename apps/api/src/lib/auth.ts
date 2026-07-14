import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import type { UserRole } from '@prisma/client';
import { UserRole as SharedUserRole, hasPermission, type Permission } from '@rss/shared'

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

const WEAK_SECRETS = new Set(['', 'secret', 'changeme', 'change-me', 'jwt_secret', 'jwt-secret']);

/** Fail fast when JWT secrets are missing or obviously insecure. Call from API boot. */
export function assertJwtSecretsConfigured(): void {
  const access = process.env.JWT_SECRET?.trim() || '';
  const refresh = process.env.JWT_REFRESH_SECRET?.trim() || '';

  if (!access || WEAK_SECRETS.has(access.toLowerCase())) {
    throw new Error('JWT_SECRET is missing or insecure. Set a strong secret in the environment.');
  }
  if (!refresh || WEAK_SECRETS.has(refresh.toLowerCase())) {
    throw new Error('JWT_REFRESH_SECRET is missing or insecure. Set a strong secret in the environment.');
  }
  if (access === refresh) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different values.');
  }
}

function accessSecret(): string {
  return process.env.JWT_SECRET as string;
}

function refreshSecret(): string {
  return process.env.JWT_REFRESH_SECRET as string;
}

export function signAccessToken(payload: JwtPayload): string {
  const options: SignOptions = { expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as SignOptions['expiresIn'] };
  return jwt.sign(payload, accessSecret(), options);
}

export function signRefreshToken(payload: JwtPayload): string {
  const options: SignOptions = { expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as SignOptions['expiresIn'] };
  return jwt.sign(payload, refreshSecret(), options);
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, accessSecret()) as JwtPayload & jwt.JwtPayload;
  return {
    userId: decoded.userId,
    email: decoded.email,
    role: decoded.role,
  };
}

export function verifyRefreshToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, refreshSecret()) as JwtPayload & jwt.JwtPayload;
  return {
    userId: decoded.userId,
    email: decoded.email,
    role: decoded.role,
  };
}

export function requirePermission(role: UserRole, permission: Permission): void {
  if (!hasPermission(role as unknown as SharedUserRole, permission)) {
    throw new Error('Forbidden');
  }
}

export function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  return Number(v);
}
