"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const auth_2 = require("../lib/auth");
const route_utils_1 = require("../lib/route-utils");
const router = (0, express_1.Router)();
router.get('/summary', auth_1.authenticate, (0, auth_1.authorize)('reports:read'), async (_req, res) => {
    try {
        const currentYear = new Date().getFullYear();
        const [totalProjects, activeProjects, completedProjects, upcomingProjects, revenueAgg, expenseAgg, bookings, soldUnits, availableUnits, pendingInstallments, employees, monthlyRevenue, monthlyExpenses, allInventory, expensesByCategory, totalLeads, totalCustomers, totalLand,] = await Promise.all([
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
            prisma_1.prisma.inventoryItem.findMany({ where: { deletedAt: null }, select: { quantity: true, minStock: true } }),
            prisma_1.prisma.expense.groupBy({
                by: ['category'],
                where: { deletedAt: null },
                _sum: { amount: true },
            }),
            prisma_1.prisma.lead.count({ where: { deletedAt: null } }),
            prisma_1.prisma.customer.count({ where: { deletedAt: null } }),
            prisma_1.prisma.landParcel.count({ where: { deletedAt: null } }),
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
                    totalLeads,
                    totalCustomers,
                    totalLand,
                },
                chartData,
            },
        });
    }
    catch (e) {
        console.error('Reports summary error:', e);
        res.status(500).json({ success: false, message: 'Failed to load report summary', error: 'Failed to load report summary' });
    }
});
router.get('/export', auth_1.authenticate, (0, auth_1.authorize)('reports:read', 'reports:export'), async (req, res) => {
    const type = String(req.query.type || '').toLowerCase();
    try {
        if (type === 'projects') {
            const rows = await prisma_1.prisma.project.findMany({
                where: { deletedAt: null },
                select: {
                    code: true,
                    name: true,
                    location: true,
                    city: true,
                    status: true,
                    budget: true,
                    estimatedCost: true,
                    actualCost: true,
                    completionPct: true,
                    startDate: true,
                    endDate: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
            });
            return res.json({ success: true, data: { type, rows } });
        }
        if (type === 'expenses') {
            const rows = await prisma_1.prisma.expense.findMany({
                where: { deletedAt: null },
                select: {
                    description: true,
                    amount: true,
                    category: true,
                    status: true,
                    expenseDate: true,
                    project: { select: { code: true, name: true } },
                    creator: { select: { firstName: true, lastName: true } },
                    createdAt: true,
                },
                orderBy: { expenseDate: 'desc' },
            });
            return res.json({ success: true, data: { type, rows } });
        }
        if (type === 'bookings') {
            const rows = await prisma_1.prisma.booking.findMany({
                where: { deletedAt: null },
                select: {
                    bookingNumber: true,
                    status: true,
                    totalAmount: true,
                    downPayment: true,
                    discount: true,
                    bookingDate: true,
                    customer: { select: { name: true, phone: true, email: true } },
                    unit: {
                        select: {
                            unitNumber: true,
                            unitType: true,
                            floor: {
                                select: {
                                    number: true,
                                    building: {
                                        select: {
                                            name: true,
                                            project: { select: { code: true, name: true } },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
            });
            return res.json({ success: true, data: { type, rows } });
        }
        if (type === 'inventory') {
            const rows = await prisma_1.prisma.inventoryItem.findMany({
                where: { deletedAt: null },
                select: {
                    sku: true,
                    name: true,
                    category: true,
                    unit: true,
                    quantity: true,
                    minStock: true,
                    unitCost: true,
                    warehouse: true,
                    barcode: true,
                    createdAt: true,
                },
                orderBy: { name: 'asc' },
            });
            return res.json({ success: true, data: { type, rows } });
        }
        return (0, route_utils_1.validationError)(res, 'Invalid export type. Use projects, expenses, bookings, or inventory.');
    }
    catch (e) {
        console.error('Reports export error:', e);
        res.status(500).json({ success: false, message: 'Failed to export report', error: 'Failed to export report' });
    }
});
exports.default = router;
