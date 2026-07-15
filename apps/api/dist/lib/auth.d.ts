import type { UserRole } from '@prisma/client';
import { type Permission } from '@rss/shared';
export interface JwtPayload {
    userId: string;
    email: string;
    role: UserRole;
}
/** Fail fast when JWT secrets are missing or obviously insecure. Call from API boot. */
export declare function assertJwtSecretsConfigured(): void;
export declare function signAccessToken(payload: JwtPayload): string;
export declare function signRefreshToken(payload: JwtPayload): string;
export declare function verifyAccessToken(token: string): JwtPayload;
export declare function verifyRefreshToken(token: string): JwtPayload;
export declare function requirePermission(role: UserRole, permission: Permission): void;
export declare function toNum(v: unknown): number;
