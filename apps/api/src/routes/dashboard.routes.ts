import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { toNum } from '../lib/auth';
import { sendPrismaError } from '../lib/route-utils';

const router = Router();

router.get('/stats', authenticate, authorize('dashboard:read'), async (req, res) => {
  try {
    const userId = req.user!.userId;
    const currentYear = new Date().getFullYear();

    const [
      totalProjects,
      activeProjects,
      completedProjects,
      upcomingProjects,
      revenueAgg,
      expenseAgg,
      bookings,
      soldUnits,
      availableUnits,
      pendingInstallments,
      employees,
      notifications,
      monthlyRevenue,
      monthlyExpenses,
      projectProgress,
      allInventory,
      expensesByCategory,
    ] = await Promise.all([
      prisma.project.count({ where: { deletedAt: null } }),
      prisma.project.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      prisma.project.count({ where: { deletedAt: null, status: 'COMPLETED' } }),
      prisma.project.count({ where: { deletedAt: null, status: 'PLANNING' } }),
      prisma.payment.aggregate({ _sum: { amount: true } }),
      prisma.expense.aggregate({ where: { deletedAt: null }, _sum: { amount: true } }),
      prisma.booking.count({ where: { deletedAt: null, status: 'CONFIRMED' } }),
      prisma.unit.count({ where: { deletedAt: null, status: 'SOLD' } }),
      prisma.unit.count({ where: { deletedAt: null, status: 'AVAILABLE' } }),
      prisma.installment.count({ where: { status: { in: ['PENDING', 'OVERDUE'] } } }),
      prisma.employee.count({ where: { isActive: true, deletedAt: null } }),
      prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10 }),
      prisma.payment.findMany({
        where: { paymentDate: { gte: new Date(currentYear, 0, 1), lt: new Date(currentYear + 1, 0, 1) } },
        select: { amount: true, paymentDate: true },
      }),
      prisma.expense.findMany({
        where: {
          deletedAt: null,
          expenseDate: { gte: new Date(currentYear, 0, 1), lt: new Date(currentYear + 1, 0, 1) },
        },
        select: { amount: true, expenseDate: true, category: true },
      }),
      prisma.project.findMany({
        where: { deletedAt: null },
        select: { name: true, completionPct: true, status: true },
        take: 8,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.inventoryItem.findMany({ where: { deletedAt: null }, select: { quantity: true, minStock: true } }),
      prisma.expense.groupBy({
        by: ['category'],
        where: { deletedAt: null },
        _sum: { amount: true },
      }),
    ]);

    const revenue = toNum(revenueAgg._sum.amount);
    const expenses = toNum(expenseAgg._sum.amount);
    const profit = revenue - expenses;

    const chartData = Array.from({ length: 12 }, (_, i) => {
      const month = new Date(currentYear, i, 1).toLocaleString('default', { month: 'short' });
      const rev = monthlyRevenue
        .filter((p) => new Date(p.paymentDate).getMonth() === i)
        .reduce((s, p) => s + toNum(p.amount), 0);
      const exp = monthlyExpenses
        .filter((e) => new Date(e.expenseDate).getMonth() === i)
        .reduce((s, e) => s + toNum(e.amount), 0);
      return { month, revenue: rev, expenses: exp, profit: rev - exp };
    });

    const lowStockCount = allInventory.filter((i) => toNum(i.quantity) <= toNum(i.minStock)).length;

    const categoryTotals = Object.fromEntries(
      expensesByCategory.map((row) => [row.category, toNum(row._sum.amount)])
    );

    res.json({
      success: true,
      data: {
        stats: {
          totalProjects,
          activeProjects,
          completedProjects,
          upcomingProjects,
          revenue,
          expenses,
          profit,
          cashFlow: profit,
          constructionCost: categoryTotals.CONSTRUCTION || 0,
          materialCost: categoryTotals.MATERIAL || 0,
          labourCost: categoryTotals.LABOUR || 0,
          equipmentCost: categoryTotals.EQUIPMENT || 0,
          bookings,
          flatsSold: soldUnits,
          flatsAvailable: availableUnits,
          outstandingPayments: pendingInstallments,
          employeeCount: employees,
          lowStockAlerts: lowStockCount,
        },
        chartData,
        projectProgress: projectProgress.map((p) => ({
          name: p.name,
          progress: toNum(p.completionPct),
          status: p.status,
        })),
        notifications,
      },
    });
  } catch (e) {
    console.error('Dashboard stats error:', e);
    res.status(500).json({ success: false, message: 'Failed to load dashboard', error: 'Failed to load dashboard' });
  }
});

export default router;
