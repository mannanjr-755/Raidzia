import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import type { UserRole } from '@prisma/client';
import { UserRole as SharedUserRole, hasPermission, type Permission } from '@rss/shared'

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export function signAccessToken(payload: JwtPayload): string {
  const options: SignOptions = { expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as SignOptions['expiresIn'] };
  return jwt.sign(payload, process.env.JWT_SECRET!, options);
}

export function signRefreshToken(payload: JwtPayload): string {
  const options: SignOptions = { expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as SignOptions['expiresIn'] };
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, options);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as JwtPayload;
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
