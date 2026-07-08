import { prisma } from '@/lib/db';
import {
  requireAuth,
  apiSuccess,
  apiError,
  isNextResponse,
  parsePagination,
  createAuditLog,
} from '@/lib/api/helpers';
import { vendorSchema } from '@/lib/validation/schemas';
import type { Prisma } from '@prisma/client';

export async function GET(request: Request) {
  const ctx = await requireAuth('vendors:read');
  if (isNextResponse(ctx)) return ctx;
  const { searchParams } = new URL(request.url);
  const { page, limit, search, sortBy, sortOrder } = parsePagination(searchParams);

  const where: Prisma.VendorWhereInput = {
    deletedAt: null,
    ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.vendor.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { [sortBy || 'createdAt']: sortOrder } }),
    prisma.vendor.count({ where }),
  ]);
  return apiSuccess({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function POST(request: Request) {
  const ctx = await requireAuth('vendors:write');
  if (isNextResponse(ctx)) return ctx;
  const body = await request.json();
  const parsed = vendorSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0]?.message || 'Validation failed');
  const data = { ...parsed.data, email: parsed.data.email || null };
  const vendor = await prisma.vendor.create({ data });
  await createAuditLog(ctx.userId, 'CREATE', 'Vendor', vendor.id, data as Record<string, unknown>);
  return apiSuccess(vendor, 201);
}
