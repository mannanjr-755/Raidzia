import { prisma } from '@/lib/db';
import {
  requireAuth,
  apiSuccess,
  apiError,
  isNextResponse,
  parsePagination,
  createAuditLog,
  createNotification,
} from '@/lib/api/helpers';
import { expenseSchema } from '@/lib/validation/schemas';
import type { Prisma } from '@prisma/client';

export async function GET(request: Request) {
  const ctx = await requireAuth('expenses:read');
  if (isNextResponse(ctx)) return ctx;
  const { searchParams } = new URL(request.url);
  const { page, limit, search, sortBy, sortOrder } = parsePagination(searchParams);
  const status = searchParams.get('status') || undefined;
  const category = searchParams.get('category') || undefined;

  const where: Prisma.ExpenseWhereInput = {
    deletedAt: null,
    ...(status ? { status: status as Prisma.EnumExpenseStatusFilter['equals'] } : {}),
    ...(category ? { category } : {}),
    ...(search ? { description: { contains: search, mode: 'insensitive' } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: { vendor: { select: { id: true, name: true } }, account: { select: { id: true, name: true } } },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy || 'expenseDate']: sortOrder },
    }),
    prisma.expense.count({ where }),
  ]);
  return apiSuccess({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function POST(request: Request) {
  const ctx = await requireAuth('expenses:write');
  if (isNextResponse(ctx)) return ctx;
  const parsed = expenseSchema.safeParse(await request.json());
  if (!parsed.success) return apiError(parsed.error.errors[0]?.message || 'Validation failed');

  const expense = await prisma.expense.create({
    data: {
      ...parsed.data,
      expenseDate: new Date(parsed.data.expenseDate),
      vendorId: parsed.data.vendorId || null,
      accountId: parsed.data.accountId || null,
    },
    include: { vendor: true, account: true },
  });

  if (parsed.data.status === 'APPROVED' || parsed.data.status === 'PAID') {
    await createNotification(ctx.userId, 'Expense Submitted', `${parsed.data.description} requires review.`, 'WARNING', '/dashboard/expenses');
  }

  await createAuditLog(ctx.userId, 'CREATE', 'Expense', expense.id);
  return apiSuccess(expense, 201);
}
