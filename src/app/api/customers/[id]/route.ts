import { prisma } from '@/lib/db';
import {
  requireAuth,
  apiSuccess,
  apiError,
  isNextResponse,
  createAuditLog,
} from '@/lib/api/helpers';
import { customerSchema } from '@/lib/validation/schemas';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuth('customers:read');
  if (isNextResponse(ctx)) return ctx;
  const { id } = await params;
  const customer = await prisma.customer.findFirst({
    where: { id, deletedAt: null },
    include: { invoices: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 10 } },
  });
  if (!customer) return apiError('Customer not found', 404);
  return apiSuccess(customer);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuth('customers:write');
  if (isNextResponse(ctx)) return ctx;
  const { id } = await params;
  const body = await request.json();
  const parsed = customerSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0]?.message || 'Validation failed');

  const existing = await prisma.customer.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return apiError('Customer not found', 404);

  const data = { ...parsed.data, email: parsed.data.email || null };
  const customer = await prisma.customer.update({ where: { id }, data });
  await createAuditLog(ctx.userId, 'UPDATE', 'Customer', id, data as Record<string, unknown>);
  return apiSuccess(customer);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuth('customers:delete');
  if (isNextResponse(ctx)) return ctx;
  const { id } = await params;
  const existing = await prisma.customer.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return apiError('Customer not found', 404);
  await prisma.customer.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  await createAuditLog(ctx.userId, 'DELETE', 'Customer', id);
  return apiSuccess({ id });
}
