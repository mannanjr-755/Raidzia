import { prisma } from '@/lib/db';
import { requireAuth, apiSuccess, apiError, isNextResponse, createAuditLog } from '@/lib/api/helpers';
import { transactionSchema } from '@/lib/validation/schemas';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuth('transactions:read');
  if (isNextResponse(ctx)) return ctx;
  const { id } = await params;
  const transaction = await prisma.transaction.findFirst({
    where: { id, deletedAt: null },
    include: { account: true },
  });
  if (!transaction) return apiError('Transaction not found', 404);
  return apiSuccess(transaction);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuth('transactions:write');
  if (isNextResponse(ctx)) return ctx;
  const { id } = await params;
  const existing = await prisma.transaction.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return apiError('Transaction not found', 404);

  const parsed = transactionSchema.safeParse(await request.json());
  if (!parsed.success) return apiError(parsed.error.errors[0]?.message || 'Validation failed');

  const transaction = await prisma.$transaction(async (tx) => {
    const oldDelta = existing.type === 'CREDIT' ? Number(existing.amount) : -Number(existing.amount);
    await tx.account.update({
      where: { id: existing.accountId },
      data: { balance: { increment: -oldDelta } },
    });

    const updated = await tx.transaction.update({
      where: { id },
      data: { ...parsed.data, date: new Date(parsed.data.date) },
      include: { account: true },
    });

    const newDelta = parsed.data.type === 'CREDIT' ? parsed.data.amount : -parsed.data.amount;
    await tx.account.update({
      where: { id: parsed.data.accountId },
      data: { balance: { increment: newDelta } },
    });

    return updated;
  });

  await createAuditLog(ctx.userId, 'UPDATE', 'Transaction', id);
  return apiSuccess(transaction);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuth('transactions:delete');
  if (isNextResponse(ctx)) return ctx;
  const { id } = await params;
  const existing = await prisma.transaction.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return apiError('Transaction not found', 404);

  await prisma.$transaction(async (tx) => {
    const delta = existing.type === 'CREDIT' ? -Number(existing.amount) : Number(existing.amount);
    await tx.account.update({
      where: { id: existing.accountId },
      data: { balance: { increment: delta } },
    });
    await tx.transaction.update({ where: { id }, data: { deletedAt: new Date() } });
  });

  await createAuditLog(ctx.userId, 'DELETE', 'Transaction', id);
  return apiSuccess({ id });
}
