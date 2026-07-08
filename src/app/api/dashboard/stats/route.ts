import { prisma } from '@/lib/db';
import { requireAuth, apiSuccess, isNextResponse } from '@/lib/api/helpers';
import { decimalToNumber } from '@/lib/export';

export async function GET() {
  const ctx = await requireAuth('dashboard:read');
  if (isNextResponse(ctx)) return ctx;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const [
    totalRevenue,
    totalExpenses,
    invoiceStats,
    customerCount,
    vendorCount,
    accountCount,
    recentInvoices,
    recentExpenses,
    monthlyRevenue,
    monthlyExpenses,
    unreadNotifications,
  ] = await Promise.all([
    prisma.invoice.aggregate({
      where: { deletedAt: null, status: 'PAID' },
      _sum: { total: true },
    }),
    prisma.expense.aggregate({
      where: { deletedAt: null, status: { in: ['APPROVED', 'PAID'] } },
      _sum: { amount: true },
    }),
    prisma.invoice.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: true,
    }),
    prisma.customer.count({ where: { deletedAt: null, isActive: true } }),
    prisma.vendor.count({ where: { deletedAt: null, isActive: true } }),
    prisma.account.count({ where: { deletedAt: null, isActive: true } }),
    prisma.invoice.findMany({
      where: { deletedAt: null },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.expense.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.invoice.findMany({
      where: { deletedAt: null, status: 'PAID', issueDate: { gte: startOfYear } },
      select: { total: true, issueDate: true },
    }),
    prisma.expense.findMany({
      where: { deletedAt: null, status: { in: ['APPROVED', 'PAID'] }, expenseDate: { gte: startOfYear } },
      select: { amount: true, expenseDate: true },
    }),
    prisma.notification.count({ where: { userId: ctx.userId, isRead: false } }),
  ]);

  const revenue = decimalToNumber(totalRevenue._sum.total);
  const expenses = decimalToNumber(totalExpenses._sum.amount);
  const profit = revenue - expenses;

  const chartData = Array.from({ length: 12 }, (_, i) => {
    const month = new Date(now.getFullYear(), i, 1);
    const monthLabel = month.toLocaleString('default', { month: 'short' });
    const rev = monthlyRevenue
      .filter((inv) => inv.issueDate.getMonth() === i)
      .reduce((s, inv) => s + decimalToNumber(inv.total), 0);
    const exp = monthlyExpenses
      .filter((e) => e.expenseDate.getMonth() === i)
      .reduce((s, e) => s + decimalToNumber(e.amount), 0);
    return { month: monthLabel, revenue: rev, expenses: exp, profit: rev - exp };
  });

  const accountBalances = await prisma.account.findMany({
    where: { deletedAt: null, isActive: true },
    select: { name: true, type: true, balance: true },
    orderBy: { balance: 'desc' },
    take: 6,
  });

  return apiSuccess({
    stats: {
      revenue,
      expenses,
      profit,
      customerCount,
      vendorCount,
      accountCount,
      unreadNotifications,
      invoiceStats: invoiceStats.map((s) => ({ status: s.status, count: s._count })),
    },
    chartData,
    accountBalances: accountBalances.map((a) => ({
      name: a.name,
      type: a.type,
      balance: decimalToNumber(a.balance),
    })),
    recentInvoices,
    recentExpenses,
    periodStart: startOfMonth.toISOString(),
  });
}
