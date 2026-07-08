"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const auth_2 = require("../lib/auth");
const router = (0, express_1.Router)();
router.get('/stats', auth_1.authenticate, (0, auth_1.authorize)('dashboard:read'), async (req, res) => {
    try {
        const userId = req.user.userId;
        const currentYear = new Date().getFullYear();
        const [totalProjects, activeProjects, completedProjects, upcomingProjects, revenueAgg, expenseAgg, bookings, soldUnits, availableUnits, pendingInstallments, employees, notifications, monthlyRevenue, monthlyExpenses, projectProgress, allInventory, expensesByCategory,] = await Promise.all([
            prisma_1.prisma.project.count({ where: { deletedAt: null } }),
            prisma_1.prisma.project.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
            prisma_1.prisma.project.count({ where: { deletedAt: null, status: 'COMPLETED' } }),
            prisma_1.prisma.project.count({ where: { deletedAt: null, status: 'PLANNING' } }),
            prisma_1.prisma.payment.aggregate({ _sum: { amount: true } }),
            prisma_1.prisma.expense.aggregate({ where: { deletedAt: null }, _sum: { amount: true } }),
            prisma_1.prisma.booking.count({ where: { deletedAt: null, status: 'CONFIRMED' } }),
            prisma_1.prisma.unit.count({ where: { deletedAt: null, status: 'SOLD' } }),
            prisma_1.prisma.unit.count({ where: { deletedAt: null, status: 'AVAILABLE' } }),
            prisma_1.prisma.installment.count({ where: { status: { in: ['PENDING', 'OVERDUE'] } } }),
            prisma_1.prisma.employee.count({ where: { isActive: true, deletedAt: null } }),
            prisma_1.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10 }),
            prisma_1.prisma.payment.findMany({
                where: { paymentDate: { gte: new Date(currentYear, 0, 1), lt: new Date(currentYear + 1, 0, 1) } },
                select: { amount: true, paymentDate: true },
            }),
            prisma_1.prisma.expense.findMany({
                where: {
                    deletedAt: null,
                    expenseDate: { gte: new Date(currentYear, 0, 1), lt: new Date(currentYear + 1, 0, 1) },
                },
                select: { amount: true, expenseDate: true, category: true },
            }),
            prisma_1.prisma.project.findMany({
                where: { deletedAt: null },
                select: { name: true, completionPct: true, status: true },
                take: 8,
                orderBy: { updatedAt: 'desc' },
            }),
            prisma_1.prisma.inventoryItem.findMany({ where: { deletedAt: null }, select: { quantity: true, minStock: true } }),
            prisma_1.prisma.expense.groupBy({
                by: ['category'],
                where: { deletedAt: null },
                _sum: { amount: true },
            }),
        ]);
        const revenue = (0, auth_2.toNum)(revenueAgg._sum.amount);
        const expenses = (0, auth_2.toNum)(expenseAgg._sum.amount);
        const profit = revenue - expenses;
        const chartData = Array.from({ length: 12 }, (_, i) => {
            const month = new Date(currentYear, i, 1).toLocaleString('default', { month: 'short' });
            const rev = monthlyRevenue
                .filter((p) => new Date(p.paymentDate).getMonth() === i)
                .reduce((s, p) => s + (0, auth_2.toNum)(p.amount), 0);
            const exp = monthlyExpenses
                .filter((e) => new Date(e.expenseDate).getMonth() === i)
                .reduce((s, e) => s + (0, auth_2.toNum)(e.amount), 0);
            return { month, revenue: rev, expenses: exp, profit: rev - exp };
        });
        const lowStockCount = allInventory.filter((i) => (0, auth_2.toNum)(i.quantity) <= (0, auth_2.toNum)(i.minStock)).length;
        const categoryTotals = Object.fromEntries(expensesByCategory.map((row) => [row.category, (0, auth_2.toNum)(row._sum.amount)]));
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
                    progress: (0, auth_2.toNum)(p.completionPct),
                    status: p.status,
                })),
                notifications,
            },
        });
    }
    catch (e) {
        console.error('Dashboard stats error:', e);
        res.status(500).json({ success: false, message: 'Failed to load dashboard', error: 'Failed to load dashboard' });
    }
});
exports.default = router;
