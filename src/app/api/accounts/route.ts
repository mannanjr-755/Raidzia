import { prisma } from '@/lib/db';
import {
  requireAuth,
  apiSuccess,
  apiError,
  isNextResponse,
  parsePagination,
  createAuditLog,
} from '@/lib/api/helpers';
import { accountSchema } from '@/lib/validation/schemas';
import type { Prisma } from '@prisma/client';

export async function GET(request: Request) {
  const ctx = await requireAuth('accounts:read');
  if (isNextResponse(ctx)) return ctx;

  const { searchParams } = new URL(request.url);
  const { page, limit, search, sortBy, sortOrder } = parsePagination(searchParams);
  const type = searchParams.get('type') || undefined;

  const where: Prisma.AccountWhereInput = {
    deletedAt: null,
    ...(type ? { type: type as Prisma.EnumAccountTypeFilter['equals'] } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.account.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy || 'createdAt']: sortOrder },
    }),
    prisma.account.count({ where }),
  ]);

  return apiSuccess({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function POST(request: Request) {
  const ctx = await requireAuth('accounts:write');
  if (isNextResponse(ctx)) return ctx;

  const body = await request.json();
  const parsed = accountSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0]?.message || 'Validation failed');

  const existing = await prisma.account.findUnique({ where: { code: parsed.data.code } });
  if (existing && !existing.deletedAt) return apiError('Account code already exists', 409);

  const account = await prisma.account.create({ data: parsed.data });
  await createAuditLog(ctx.userId, 'CREATE', 'Account', account.id, parsed.data as Record<string, unknown>);

  return apiSuccess(account, 201);
}
