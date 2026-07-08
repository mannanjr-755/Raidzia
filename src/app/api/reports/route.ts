import { prisma } from '@/lib/db';
import { requireAuth, apiSuccess, isNextResponse } from '@/lib/api/helpers';
import { generateExcel, generatePdf, decimalToNumber } from '@/lib/export';

export async function GET(request: Request) {
  const ctx = await requireAuth('reports:read');
  if (isNextResponse(ctx)) return ctx;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'summary';
  const format = searchParams.get('format') || 'json';

  let data: Record<string, unknown> = {};

  if (type === 'summary' || type === 'all') {
    const [revenue, expenses, invoices, customers] = await Promise.all([
      prisma.invoice.aggregate({ where: { deletedAt: null, status: 'PAID' }, _sum: { total: true } }),
      prisma.expense.aggregate({ where: { deletedAt: null }, _sum: { amount: true } }),
      prisma.invoice.findMany({ where: { deletedAt: null }, include: { customer: { select: { name: true } } } }),
      prisma.customer.findMany({ where: { deletedAt: null } }),
    ]);
    data = {
      totalRevenue: decimalToNumber(revenue._sum.total),
      totalExpenses: decimalToNumber(expenses._sum.amount),
      profit: decimalToNumber(revenue._sum.total) - decimalToNumber(expenses._sum.amount),
      invoiceCount: invoices.length,
      customerCount: customers.length,
    };
  }

  if (type === 'invoices' || type === 'all') {
    const invoices = await prisma.invoice.findMany({
      where: { deletedAt: null },
      include: { customer: { select: { name: true } } },
      orderBy: { issueDate: 'desc' },
    });
    data.invoices = invoices.map((inv) => ({
      number: inv.invoiceNumber,
      customer: inv.customer.name,
      status: inv.status,
      total: decimalToNumber(inv.total),
      issueDate: inv.issueDate.toISOString().split('T')[0],
    }));
  }

  if (type === 'expenses' || type === 'all') {
    const expenses = await prisma.expense.findMany({
      where: { deletedAt: null },
      include: { vendor: { select: { name: true } } },
      orderBy: { expenseDate: 'desc' },
    });
    data.expenses = expenses.map((e) => ({
      description: e.description,
      category: e.category,
      vendor: e.vendor?.name || '-',
      amount: decimalToNumber(e.amount),
      status: e.status,
      date: e.expenseDate.toISOString().split('T')[0],
    }));
  }

  if (format === 'json') return apiSuccess(data);

  if (format === 'excel') {
    const buffer = await generateExcel('Report', [
      { header: 'Field', key: 'field' },
      { header: 'Value', key: 'value' },
    ], Object.entries(data).map(([k, v]) => ({ field: k, value: JSON.stringify(v) })));
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="report-${type}.xlsx"`,
      },
    });
  }

  if (format === 'pdf') {
    const rows = Object.entries(data).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]);
    const buffer = await generatePdf(`LedgerPro ${type} Report`, ['Field', 'Value'], rows);
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="report-${type}.pdf"`,
      },
    });
  }

  return apiSuccess(data);
}
