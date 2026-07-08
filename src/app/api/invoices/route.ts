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
import { invoiceSchema } from '@/lib/validation/schemas';
import type { Prisma } from '@prisma/client';

function calcInvoiceTotals(items: { quantity: number; unitPrice: number }[], taxRate: number) {
  const lineItems = items.map((i) => ({
    ...i,
    amount: i.quantity * i.unitPrice,
  }));
  const subtotal = lineItems.reduce((s, i) => s + i.amount, 0);
  const taxAmount = subtotal * (taxRate / 100);
  return { lineItems, subtotal, taxAmount, total: subtotal + taxAmount };
}

export async function GET(request: Request) {
  const ctx = await requireAuth('invoices:read');
  if (isNextResponse(ctx)) return ctx;
  const { searchParams } = new URL(request.url);
  const { page, limit, search, sortBy, sortOrder } = parsePagination(searchParams);
  const status = searchParams.get('status') || undefined;

  const where: Prisma.InvoiceWhereInput = {
    deletedAt: null,
    ...(status ? { status: status as Prisma.EnumInvoiceStatusFilter['equals'] } : {}),
    ...(search
      ? {
          OR: [
            { invoiceNumber: { contains: search, mode: 'insensitive' } },
            { customer: { name: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: { customer: { select: { id: true, name: true } } },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy || 'createdAt']: sortOrder },
    }),
    prisma.invoice.count({ where }),
  ]);
  return apiSuccess({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function POST(request: Request) {
  const ctx = await requireAuth('invoices:write');
  if (isNextResponse(ctx)) return ctx;
  const body = await request.json();
  const parsed = invoiceSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0]?.message || 'Validation failed');

  const count = await prisma.invoice.count();
  const invoiceNumber = body.invoiceNumber || `INV-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;
  const { lineItems, subtotal, taxAmount, total } = calcInvoiceTotals(parsed.data.items, parsed.data.taxRate);

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      customerId: parsed.data.customerId,
      status: parsed.data.status,
      issueDate: new Date(parsed.data.issueDate),
      dueDate: new Date(parsed.data.dueDate),
      subtotal,
      taxRate: parsed.data.taxRate,
      taxAmount,
      total,
      notes: parsed.data.notes,
      items: {
        create: lineItems.map((i, idx) => ({
          description: parsed.data.items[idx].description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          amount: i.amount,
        })),
      },
    },
    include: { customer: true, items: true },
  });

  if (parsed.data.status === 'PAID') {
    await prisma.customer.update({
      where: { id: parsed.data.customerId },
      data: { balance: { decrement: total } },
    });
  }

  await createAuditLog(ctx.userId, 'CREATE', 'Invoice', invoice.id);
  await createNotification(ctx.userId, 'Invoice Created', `Invoice ${invoiceNumber} created.`, 'SUCCESS', '/dashboard/invoices');
  return apiSuccess(invoice, 201);
}
