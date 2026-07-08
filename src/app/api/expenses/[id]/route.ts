import { prisma } from '@/lib/db';
import { requireAuth, apiSuccess, apiError, isNextResponse, createAuditLog, createNotification } from '@/lib/api/helpers';
import { expenseSchema } from '@/lib/validation/schemas';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuth('expenses:read');
  if (isNextResponse(ctx)) return ctx;
  const { id } = await params;
  const expense = await prisma.expense.findFirst({
    where: { id, deletedAt: null },
    include: { vendor: true, account: true },
  });
  if (!expense) return apiError('Expense not found', 404);
  return apiSuccess(expense);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuth('expenses:write');
  if (isNextResponse(ctx)) return ctx;
  const { id } = await params;
  const existing = await prisma.expense.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return apiError('Expense not found', 404);

  const parsed = expenseSchema.safeParse(await request.json());
  if (!parsed.success) return apiError(parsed.error.errors[0]?.message || 'Validation failed');

  const expense = await prisma.expense.update({
    where: { id },
    data: {
      ...parsed.data,
      expenseDate: new Date(parsed.data.expenseDate),
      vendorId: parsed.data.vendorId || null,
      accountId: parsed.data.accountId || null,
    },
    include: { vendor: true, account: true },
  });

  if (existing.status !== parsed.data.status) {
    await createNotification(
      ctx.userId,
      'Expense Status Updated',
      `${expense.description} is now ${parsed.data.status}.`,
      parsed.data.status === 'APPROVED' ? 'SUCCESS' : 'INFO',
      '/dashboard/expenses'
    );
    if (parsed.data.status === 'PAID' && expense.accountId) {
      await prisma.account.update({
        where: { id: expense.accountId },
        data: { balance: { increment: parsed.data.amount } },
      });
    }
  }

  await createAuditLog(ctx.userId, 'UPDATE', 'Expense', id, { status: parsed.data.status });
  return apiSuccess(expense);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuth('expenses:delete');
  if (isNextResponse(ctx)) return ctx;
  const { id } = await params;
  const existing = await prisma.expense.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return apiError('Expense not found', 404);
  await prisma.expense.update({ where: { id }, data: { deletedAt: new Date() } });
  await createAuditLog(ctx.userId, 'DELETE', 'Expense', id);
  return apiSuccess({ id });
}
