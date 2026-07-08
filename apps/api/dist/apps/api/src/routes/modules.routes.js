"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const business_service_1 = require("../services/business.service");
const route_utils_1 = require("../lib/route-utils");
const router = (0, express_1.Router)();
const param = (value) => Array.isArray(value) ? value[0] : String(value || '');
const expenseCategoryEnum = zod_1.z.enum([
    'FUEL', 'ELECTRICITY', 'WATER', 'CONSTRUCTION', 'LABOUR', 'MATERIAL',
    'EQUIPMENT', 'OFFICE', 'MARKETING', 'TRANSPORT', 'UTILITIES', 'MAINTENANCE', 'OTHER',
]);
const expenseSchema = zod_1.z.object({
    description: zod_1.z.string().min(1, 'Description is required'),
    amount: zod_1.z.coerce.number().positive('Amount must be greater than zero'),
    category: expenseCategoryEnum.default('OTHER'),
    expenseDate: zod_1.z.string().optional(),
    projectId: zod_1.z.string().optional().nullable(),
    receiptUrl: zod_1.z.string().optional(),
});
const inventorySchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required'),
    sku: zod_1.z.string().min(1, 'SKU is required'),
    category: zod_1.z.string().min(1, 'Category is required'),
    unit: zod_1.z.string().min(1).default('pcs'),
    quantity: zod_1.z.coerce.number().min(0).default(0),
    minStock: zod_1.z.coerce.number().min(0).default(0),
    unitCost: zod_1.z.coerce.number().min(0).default(0),
});
const stockSchema = zod_1.z.object({
    quantity: zod_1.z.coerce.number().positive('Quantity must be greater than zero'),
    notes: zod_1.z.string().optional(),
});
router.get('/accounts', auth_1.authenticate, (0, auth_1.authorize)('accounting:read'), async (_req, res) => {
    const items = await prisma_1.prisma.chartAccount.findMany({ where: { deletedAt: null }, orderBy: { code: 'asc' } });
    res.json({ success: true, data: items });
});
router.get('/journal', auth_1.authenticate, (0, auth_1.authorize)('accounting:read'), async (_req, res) => {
    const items = await prisma_1.prisma.journalEntry.findMany({
        include: { lines: { include: { account: true } } },
        orderBy: { date: 'desc' }, take: 50,
    });
    res.json({ success: true, data: items });
});
router.get('/expenses', auth_1.authenticate, (0, auth_1.authorize)('expenses:read'), async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page || 1)));
    const limit = Math.min(100, parseInt(String(req.query.limit || 10)));
    const [items, total] = await Promise.all([
        prisma_1.prisma.expense.findMany({
            where: { deletedAt: null },
            include: { project: { select: { name: true } }, creator: { select: { firstName: true, lastName: true } } },
            skip: (page - 1) * limit, take: limit, orderBy: { expenseDate: 'desc' },
        }),
        prisma_1.prisma.expense.count({ where: { deletedAt: null } }),
    ]);
    res.json({ success: true, data: { items, total, page, limit, totalPages: Math.ceil(total / limit) } });
});
router.post('/expenses', auth_1.authenticate, (0, auth_1.authorize)('expenses:write'), async (req, res) => {
    const parsed = expenseSchema.safeParse(req.body);
    if (!parsed.success)
        return (0, route_utils_1.validationError)(res, parsed.error.errors[0]?.message || 'Invalid expense data');
    try {
        const expense = await prisma_1.prisma.expense.create({
            data: {
                description: parsed.data.description,
                amount: parsed.data.amount,
                category: parsed.data.category,
                projectId: parsed.data.projectId || null,
                receiptUrl: parsed.data.receiptUrl,
                creatorId: req.user.userId,
                expenseDate: parsed.data.expenseDate ? new Date(parsed.data.expenseDate) : new Date(),
            },
            include: { project: { select: { name: true } }, creator: { select: { firstName: true, lastName: true } } },
        });
        res.status(201).json({ success: true, data: expense });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to create expense');
    }
});
router.post('/expenses/:id/approve', auth_1.authenticate, (0, auth_1.authorize)('expenses:write'), async (req, res) => {
    try {
        const expense = await (0, business_service_1.approveExpense)(param(req.params.id), req.user.userId);
        res.json({ success: true, data: expense });
    }
    catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
});
router.get('/inventory', auth_1.authenticate, (0, auth_1.authorize)('inventory:read'), async (_req, res) => {
    const items = await prisma_1.prisma.inventoryItem.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } });
    res.json({ success: true, data: items });
});
router.post('/inventory', auth_1.authenticate, (0, auth_1.authorize)('inventory:write'), async (req, res) => {
    const parsed = inventorySchema.safeParse(req.body);
    if (!parsed.success)
        return (0, route_utils_1.validationError)(res, parsed.error.errors[0]?.message || 'Invalid inventory data');
    try {
        const item = await prisma_1.prisma.inventoryItem.create({ data: parsed.data });
        res.status(201).json({ success: true, data: item });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to create inventory item');
    }
});
router.post('/inventory/:id/stock-in', auth_1.authenticate, (0, auth_1.authorize)('inventory:write'), async (req, res) => {
    const id = param(req.params.id);
    const parsed = stockSchema.safeParse(req.body);
    if (!parsed.success)
        return (0, route_utils_1.validationError)(res, parsed.error.errors[0]?.message || 'Invalid stock data');
    try {
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.inventoryItem.update({
                where: { id },
                data: { quantity: { increment: parsed.data.quantity } },
            }),
            prisma_1.prisma.stockMovement.create({
                data: {
                    inventoryItemId: id,
                    type: 'IN',
                    quantity: parsed.data.quantity,
                    notes: parsed.data.notes,
                },
            }),
        ]);
        const item = await prisma_1.prisma.inventoryItem.findUnique({ where: { id } });
        res.json({ success: true, data: item });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to add stock');
    }
});
router.post('/inventory/:id/stock-out', auth_1.authenticate, (0, auth_1.authorize)('inventory:write'), async (req, res) => {
    const parsed = stockSchema.safeParse(req.body);
    if (!parsed.success)
        return (0, route_utils_1.validationError)(res, parsed.error.errors[0]?.message || 'Invalid stock data');
    try {
        const item = await (0, business_service_1.stockOut)(param(req.params.id), parsed.data.quantity, req.body.projectId, parsed.data.notes);
        res.json({ success: true, data: item });
    }
    catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
});
router.get('/properties/digital-twin/:projectId', auth_1.authenticate, (0, auth_1.authorize)('digital-twin:read'), async (req, res) => {
    const projectId = param(req.params.projectId);
    const buildings = await prisma_1.prisma.building.findMany({
        where: { projectId },
        include: {
            floors: {
                orderBy: { number: 'asc' },
                include: {
                    units: {
                        include: {
                            bookings: {
                                where: { status: 'CONFIRMED' },
                                include: { customer: true, installments: true },
                            },
                        },
                    },
                },
            },
        },
    });
    res.json({ success: true, data: buildings });
});
router.get('/notifications', auth_1.authenticate, (0, auth_1.authorize)('notifications:read'), async (req, res) => {
    const items = await prisma_1.prisma.notification.findMany({
        where: { userId: req.user.userId },
        orderBy: { createdAt: 'desc' }, take: 50,
    });
    res.json({ success: true, data: items });
});
router.patch('/notifications/:id/read', auth_1.authenticate, (0, auth_1.authorize)('notifications:read'), async (req, res) => {
    const id = param(req.params.id);
    try {
        await prisma_1.prisma.notification.updateMany({
            where: { id, userId: req.user.userId },
            data: { isRead: true },
        });
        res.json({ success: true, data: null });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to update notification');
    }
});
exports.default = router;
