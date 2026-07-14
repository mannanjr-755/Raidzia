import { prisma } from '@/lib/db';
import {
  requireAuth,
  apiSuccess,
  apiError,
  isNextResponse,
  parsePagination,
  createAuditLog,
} from '@/lib/api/helpers';
import { transactionSchema } from '@/lib/validation/schemas';
import type { Prisma } from '@/generated/prisma';

export async function GET(request: Request) {
  const ctx = await requireAuth('transactions:read');
  if (isNextResponse(ctx)) return ctx;
  const { searchParams } = new URL(request.url);
  const { page, limit, search, sortBy, sortOrder } = parsePagination(searchParams);
  const type = searchParams.get('type') || undefined;

  const where: Prisma.TransactionWhereInput = {
    deletedAt: null,
    ...(type ? { type: type as Prisma.EnumTransactionTypeFilter['equals'] } : {}),
    ...(search
      ? {
          OR: [
            { reference: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { account: { select: { id: true, name: true, code: true } } },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy || 'date']: sortOrder },
    }),
    prisma.transaction.count({ where }),
  ]);
  return apiSuccess({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function POST(request: Request) {
  const ctx = await requireAuth('transactions:write');
  if (isNextResponse(ctx)) return ctx;
  const parsed = transactionSchema.safeParse(await request.json());
  if (!parsed.success) return apiError(parsed.error.errors[0]?.message || 'Validation failed');

  const dup = await prisma.transaction.findFirst({ where: { reference: parsed.data.reference, deletedAt: null } });
  if (dup) return apiError('Reference already exists', 409);

  const transaction = await prisma.$transaction(async (tx) => {
    const created = await tx.transaction.create({
      data: {
        ...parsed.data,
        date: new Date(parsed.data.date),
      },
      include: { account: true },
    });

    const delta = parsed.data.type === 'CREDIT' ? parsed.data.amount : -parsed.data.amount;
    await tx.account.update({
      where: { id: parsed.data.accountId },
      data: { balance: { increment: delta } },
    });

    return created;
  });

  await createAuditLog(ctx.userId, 'CREATE', 'Transaction', transaction.id);
  return apiSuccess(transaction, 201);
}
