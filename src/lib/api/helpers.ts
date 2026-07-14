import { NextResponse } from 'next/server';
import type { Prisma, UserRole } from '@/generated/prisma';
import { getSession } from '@/lib/auth/session-manager';
import { hasPermission, type Permission } from '@/lib/rbac/permissions';

export interface ApiContext {
  userId: string;
  role: UserRole;
  username: string;
}

export async function getApiContext(): Promise<ApiContext | null> {
  const session = await getSession();
  if (!session) return null;
  return {
    userId: session.user.id,
    role: session.user.role as UserRole,
    username: session.user.username,
  };
}

export async function requireAuth(permission?: Permission): Promise<ApiContext | NextResponse> {
  const ctx = await getApiContext();
  if (!ctx) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (permission && !hasPermission(ctx.role, permission)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }
  return ctx;
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function isNextResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

export interface PaginationParams {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function parsePagination(searchParams: URLSearchParams): PaginationParams {
  return {
    page: Math.max(1, parseInt(searchParams.get('page') || '1', 10)),
    limit: Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10))),
    search: searchParams.get('search') || undefined,
    sortBy: searchParams.get('sortBy') || undefined,
    sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
  };
}

export async function createAuditLog(
  userId: string,
  action: string,
  entity: string,
  entityId?: string,
  details?: Record<string, unknown>
) {
  const { prisma } = await import('@/lib/db');
  await prisma.auditLog.create({
    data: { userId, action, entity, entityId, details: details as Prisma.InputJsonValue | undefined },
  });
}

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' = 'INFO',
  link?: string
) {
  const { prisma } = await import('@/lib/db');
  return prisma.notification.create({
    data: { userId, title, message, type, link },
  });
}
