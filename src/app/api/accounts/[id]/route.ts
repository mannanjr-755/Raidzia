import { prisma } from '@/lib/db';
import {
  requireAuth,
  apiSuccess,
  apiError,
  isNextResponse,
  createAuditLog,
} from '@/lib/api/helpers';
import { accountSchema } from '@/lib/validation/schemas';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuth('accounts:read');
  if (isNextResponse(ctx)) return ctx;

  const { id } = await params;
  const account = await prisma.account.findFirst({ where: { id, deletedAt: null } });
  if (!account) return apiError('Account not found', 404);
  return apiSuccess(account);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuth('accounts:write');
  if (isNextResponse(ctx)) return ctx;

  const { id } = await params;
  const body = await request.json();
  const parsed = accountSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0]?.message || 'Validation failed');

  const existing = await prisma.account.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return apiError('Account not found', 404);

  const duplicate = await prisma.account.findFirst({
    where: { code: parsed.data.code, id: { not: id }, deletedAt: null },
  });
  if (duplicate) return apiError('Account code already exists', 409);

  const account = await prisma.account.update({ where: { id }, data: parsed.data });
  await createAuditLog(ctx.userId, 'UPDATE', 'Account', id, parsed.data as Record<string, unknown>);
  return apiSuccess(account);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuth('accounts:delete');
  if (isNextResponse(ctx)) return ctx;

  const { id } = await params;
  const existing = await prisma.account.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return apiError('Account not found', 404);

  await prisma.account.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  await createAuditLog(ctx.userId, 'DELETE', 'Account', id);
  return apiSuccess({ id });
}
