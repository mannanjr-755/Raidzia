import { prisma } from '@/lib/db';
import { requireAuth, apiSuccess, apiError, isNextResponse, createAuditLog } from '@/lib/api/helpers';
import { vendorSchema } from '@/lib/validation/schemas';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuth('vendors:read');
  if (isNextResponse(ctx)) return ctx;
  const { id } = await params;
  const vendor = await prisma.vendor.findFirst({
    where: { id, deletedAt: null },
    include: { expenses: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 10 } },
  });
  if (!vendor) return apiError('Vendor not found', 404);
  return apiSuccess(vendor);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuth('vendors:write');
  if (isNextResponse(ctx)) return ctx;
  const { id } = await params;
  const parsed = vendorSchema.safeParse(await request.json());
  if (!parsed.success) return apiError(parsed.error.errors[0]?.message || 'Validation failed');
  const existing = await prisma.vendor.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return apiError('Vendor not found', 404);
  const data = { ...parsed.data, email: parsed.data.email || null };
  const vendor = await prisma.vendor.update({ where: { id }, data });
  await createAuditLog(ctx.userId, 'UPDATE', 'Vendor', id, data as Record<string, unknown>);
  return apiSuccess(vendor);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuth('vendors:delete');
  if (isNextResponse(ctx)) return ctx;
  const { id } = await params;
  const existing = await prisma.vendor.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return apiError('Vendor not found', 404);
  await prisma.vendor.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  await createAuditLog(ctx.userId, 'DELETE', 'Vendor', id);
  return apiSuccess({ id });
}
