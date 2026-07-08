import { NextResponse } from 'next/server';
import { requireAuth, apiError, isNextResponse } from '@/lib/api/helpers';
import { generateExcel, generatePdf, decimalToNumber } from '@/lib/export';
import { prisma } from '@/lib/db';

const ENTITY_CONFIG: Record<string, { permission: 'accounts:read' | 'customers:read' | 'vendors:read' | 'invoices:read' | 'expenses:read' | 'transactions:read'; fetch: () => Promise<Record<string, unknown>[]>; columns: { header: string; key: string }[] }> = {
  accounts: {
    permission: 'accounts:read',
    fetch: async () => {
      const items = await prisma.account.findMany({ where: { deletedAt: null } });
      return items.map((a) => ({ code: a.code, name: a.name, type: a.type, balance: decimalToNumber(a.balance), active: a.isActive }));
    },
    columns: [
      { header: 'Code', key: 'code' },
      { header: 'Name', key: 'name' },
      { header: 'Type', key: 'type' },
      { header: 'Balance', key: 'balance' },
      { header: 'Active', key: 'active' },
    ],
  },
  customers: {
    permission: 'customers:read',
    fetch: async () => {
      const items = await prisma.customer.findMany({ where: { deletedAt: null } });
      return items.map((c) => ({ name: c.name, email: c.email || '', phone: c.phone || '', balance: decimalToNumber(c.balance) }));
    },
    columns: [
      { header: 'Name', key: 'name' },
      { header: 'Email', key: 'email' },
      { header: 'Phone', key: 'phone' },
      { header: 'Balance', key: 'balance' },
    ],
  },
  invoices: {
    permission: 'invoices:read',
    fetch: async () => {
      const items = await prisma.invoice.findMany({ where: { deletedAt: null }, include: { customer: true } });
      return items.map((i) => ({ number: i.invoiceNumber, customer: i.customer.name, status: i.status, total: decimalToNumber(i.total) }));
    },
    columns: [
      { header: 'Number', key: 'number' },
      { header: 'Customer', key: 'customer' },
      { header: 'Status', key: 'status' },
      { header: 'Total', key: 'total' },
    ],
  },
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const entity = searchParams.get('entity') || 'accounts';
  const format = searchParams.get('format') || 'excel';

  const config = ENTITY_CONFIG[entity];
  if (!config) return apiError('Invalid entity', 400);

  const ctx = await requireAuth('reports:export');
  if (isNextResponse(ctx)) return ctx;

  const rows = await config.fetch();

  if (format === 'excel') {
    const buffer = await generateExcel(entity, config.columns, rows);
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${entity}-export.xlsx"`,
      },
    });
  }

  if (format === 'pdf') {
    const buffer = await generatePdf(
      `${entity} Export`,
      config.columns.map((c) => c.header),
      rows.map((r) => config.columns.map((c) => String(r[c.key] ?? '')))
    );
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${entity}-export.pdf"`,
      },
    });
  }

  return NextResponse.json({ success: true, data: rows });
}
