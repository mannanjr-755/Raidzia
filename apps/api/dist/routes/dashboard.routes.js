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
        const [totalProjects, activeProjects, completedProjects, upcomingProjects, revenueAgg, expenseAgg, bookings, soldUnits, availableUnits, pendingInstallments, employees, notifications, monthlyRevenue, monthlyExpenses, projectProgress, allInventory, expensesByCategory, feasibilityStudies, feasibilityRevenueAgg, feasibilityProfitData, recentFeasibilityStudies,] = await Promise.all([
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
            prisma_1.prisma.projectFeasibilityStudy.findMany({
                where: { deletedAt: null },
                include: { costs: true, revenues: true },
            }),
            prisma_1.prisma.projectFeasibilityStudy.aggregate({
                where: { deletedAt: null },
                _sum: {
                    contractValue: true,
                    variationOrders: true,
                    additionalIncome: true,
                    retentionRelease: true,
                    otherRevenue: true,
                },
            }),
            prisma_1.prisma.projectFeasibilityStudy.findMany({
                where: { deletedAt: null },
                include: { costs: true, revenues: true },
            }),
            prisma_1.prisma.projectFeasibilityStudy.findMany({
                where: { deletedAt: null },
                include: { costs: true, revenues: true },
                orderBy: { createdAt: 'desc' },
                take: 5,
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
        const feasibilityComputed = feasibilityProfitData.map((study) => {
            const baseRevenue = (0, auth_2.toNum)(study.contractValue) +
                (0, auth_2.toNum)(study.variationOrders) +
                (0, auth_2.toNum)(study.additionalIncome) +
                (0, auth_2.toNum)(study.retentionRelease) +
                (0, auth_2.toNum)(study.otherRevenue);
            const dynamicRevenue = study.revenues.reduce((sum, item) => sum + (0, auth_2.toNum)(item.amount), 0);
            const subtotalCost = study.costs.reduce((sum, item) => sum + (0, auth_2.toNum)(item.amount), 0);
            const taxAmount = (subtotalCost * (0, auth_2.toNum)(study.taxPercentage)) / 100;
            const contingencyAmount = (subtotalCost * (0, auth_2.toNum)(study.contingencyPercentage)) / 100;
            const totalCost = subtotalCost + taxAmount + contingencyAmount;
            const totalRevenue = baseRevenue + dynamicRevenue;
            const netProfit = totalRevenue - totalCost;
            const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
            return { netProfit, profitMargin };
        });
        const projectsInProfit = feasibilityComputed.filter((item) => item.netProfit > 0).length;
        const projectsInLoss = feasibilityComputed.filter((item) => item.netProfit < 0).length;
        const expectedProfit = feasibilityComputed.reduce((sum, item) => sum + item.netProfit, 0);
        const averageProfitMargin = feasibilityComputed.length > 0
            ? feasibilityComputed.reduce((sum, item) => sum + item.profitMargin, 0) / feasibilityComputed.length
            : 0;
        const expectedRevenue = (0, auth_2.toNum)(feasibilityRevenueAgg._sum.contractValue) +
            (0, auth_2.toNum)(feasibilityRevenueAgg._sum.variationOrders) +
            (0, auth_2.toNum)(feasibilityRevenueAgg._sum.additionalIncome) +
            (0, auth_2.toNum)(feasibilityRevenueAgg._sum.retentionRelease) +
            (0, auth_2.toNum)(feasibilityRevenueAgg._sum.otherRevenue) +
            feasibilityStudies.reduce((sum, study) => sum + study.revenues.reduce((s, r) => s + (0, auth_2.toNum)(r.amount), 0), 0);
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
                    numberOfFeasibilityStudies: feasibilityStudies.length,
                    expectedRevenue,
                    expectedProfit,
                    projectsInProfit,
                    projectsInLoss,
                    averageProfitMargin,
                },
                chartData,
                projectProgress: projectProgress.map((p) => ({
                    name: p.name,
                    progress: (0, auth_2.toNum)(p.completionPct),
                    status: p.status,
                })),
                notifications,
                recentFeasibilityStudies: recentFeasibilityStudies.map((study) => ({
                    id: study.id,
                    projectName: study.projectName,
                    projectType: study.projectType,
                    createdAt: study.createdAt,
                })),
            },
        });
    }
    catch (e) {
        console.error('Dashboard stats error:', e);
        res.status(500).json({ success: false, message: 'Failed to load dashboard', error: 'Failed to load dashboard' });
    }
});
exports.default = router;
