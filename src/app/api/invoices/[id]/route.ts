import { prisma } from '@/lib/db';
import { requireAuth, apiSuccess, apiError, isNextResponse, createAuditLog, createNotification } from '@/lib/api/helpers';
import { invoiceSchema } from '@/lib/validation/schemas';

function calcTotals(items: { quantity: number; unitPrice: number; description: string }[], taxRate: number) {
  const lineItems = items.map((i) => ({ ...i, amount: i.quantity * i.unitPrice }));
  const subtotal = lineItems.reduce((s, i) => s + i.amount, 0);
  const taxAmount = subtotal * (taxRate / 100);
  return { lineItems, subtotal, taxAmount, total: subtotal + taxAmount };
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuth('invoices:read');
  if (isNextResponse(ctx)) return ctx;
  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({
    where: { id, deletedAt: null },
    include: { customer: true, items: true },
  });
  if (!invoice) return apiError('Invoice not found', 404);
  return apiSuccess(invoice);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuth('invoices:write');
  if (isNextResponse(ctx)) return ctx;
  const { id } = await params;
  const existing = await prisma.invoice.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return apiError('Invoice not found', 404);

  const body = await request.json();
  const parsed = invoiceSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0]?.message || 'Validation failed');

  const { lineItems, subtotal, taxAmount, total } = calcTotals(parsed.data.items, parsed.data.taxRate);
  const oldStatus = existing.status;
  const newStatus = parsed.data.status;

  await prisma.invoiceItem.deleteMany({ where: { invoiceId: id } });
  const invoice = await prisma.invoice.update({
    where: { id },
    data: {
      customerId: parsed.data.customerId,
      status: newStatus,
      issueDate: new Date(parsed.data.issueDate),
      dueDate: new Date(parsed.data.dueDate),
      subtotal,
      taxRate: parsed.data.taxRate,
      taxAmount,
      total,
      notes: parsed.data.notes,
      items: { create: lineItems },
    },
    include: { customer: true, items: true },
  });

  if (oldStatus !== 'PAID' && newStatus === 'PAID') {
    await prisma.customer.update({
      where: { id: parsed.data.customerId },
      data: { balance: { decrement: total } },
    });
    await createNotification(ctx.userId, 'Invoice Paid', `Invoice ${invoice.invoiceNumber} marked as paid.`, 'SUCCESS');
  }

  await createAuditLog(ctx.userId, 'UPDATE', 'Invoice', id);
  return apiSuccess(invoice);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuth('invoices:delete');
  if (isNextResponse(ctx)) return ctx;
  const { id } = await params;
  const existing = await prisma.invoice.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return apiError('Invoice not found', 404);
  await prisma.invoice.update({ where: { id }, data: { deletedAt: new Date(), status: 'CANCELLED' } });
  await createAuditLog(ctx.userId, 'DELETE', 'Invoice', id);
  return apiSuccess({ id });
}
