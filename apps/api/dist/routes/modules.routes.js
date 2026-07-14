"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const pagination_1 = require("../lib/pagination");
const business_service_1 = require("../services/business.service");
const route_utils_1 = require("../lib/route-utils");
const router = (0, express_1.Router)();
const param = (value) => Array.isArray(value) ? value[0] : String(value || '');
const expenseCategoryEnum = zod_1.z.enum([
    'FUEL', 'ELECTRICITY', 'WATER', 'CONSTRUCTION', 'LABOUR', 'MATERIAL',
    'EQUIPMENT', 'OFFICE', 'MARKETING', 'TRANSPORT', 'UTILITIES', 'MAINTENANCE', 'OTHER',
]);
const expenseStatusEnum = zod_1.z.enum(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PAID']);
const expenseSchema = zod_1.z.object({
    description: zod_1.z.string().min(1, 'Description is required'),
    amount: zod_1.z.coerce.number().positive('Amount must be greater than zero'),
    category: expenseCategoryEnum.default('OTHER'),
    status: expenseStatusEnum.optional(),
    expenseDate: zod_1.z.string().optional(),
    projectId: zod_1.z.string().optional().nullable(),
    accountId: zod_1.z.string().optional().nullable(),
    receiptUrl: zod_1.z.string().optional(),
});
const inventorySchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required'),
    sku: zod_1.z.string().optional(),
    category: zod_1.z.string().min(1, 'Category is required'),
    unit: zod_1.z.string().min(1).default('pcs'),
    quantity: zod_1.z.coerce.number().min(0).default(0),
    minStock: zod_1.z.coerce.number().min(0).default(0),
    unitCost: zod_1.z.coerce.number().min(0).default(0),
    barcode: zod_1.z.string().optional(),
    warehouse: zod_1.z.string().optional(),
});
const stockSchema = zod_1.z.object({
    quantity: zod_1.z.coerce.number().positive('Quantity must be greater than zero'),
    notes: zod_1.z.string().optional(),
});
const accountTypeEnum = zod_1.z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']);
const accountSchema = zod_1.z.object({
    code: zod_1.z.string().min(1, 'Code is required'),
    name: zod_1.z.string().min(1, 'Name is required'),
    type: accountTypeEnum,
    parentId: zod_1.z.string().optional().nullable(),
    isActive: zod_1.z.boolean().optional(),
});
const journalLineSchema = zod_1.z.object({
    accountId: zod_1.z.string().min(1),
    debit: zod_1.z.coerce.number().min(0).default(0),
    credit: zod_1.z.coerce.number().min(0).default(0),
    description: zod_1.z.string().optional(),
});
const journalSchema = zod_1.z.object({
    description: zod_1.z.string().min(1, 'Description is required'),
    reference: zod_1.z.string().optional(),
    date: zod_1.z.string().optional(),
    lines: zod_1.z.array(journalLineSchema).min(1, 'At least one journal line is required'),
});
async function generateJournalEntryNumber() {
    const year = new Date().getFullYear();
    const prefix = `JE-${year}-`;
    const latest = await prisma_1.prisma.journalEntry.findFirst({
        where: { entryNumber: { startsWith: prefix } },
        orderBy: { entryNumber: 'desc' },
        select: { entryNumber: true },
    });
    let next = 1;
    if (latest?.entryNumber) {
        const tail = parseInt(latest.entryNumber.slice(prefix.length), 10);
        if (!Number.isNaN(tail))
            next = tail + 1;
    }
    return `${prefix}${String(next).padStart(4, '0')}`;
}
// ---------- Accounting ----------
router.get('/accounts', auth_1.authenticate, (0, auth_1.authorize)('accounting:read'), async (req, res) => {
    const { page, limit, search, skip } = (0, pagination_1.getPagination)(req);
    const type = String(req.query.type || '');
    const where = {
        deletedAt: null,
        ...(type ? { type: type } : {}),
        ...(search
            ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { code: { contains: search, mode: 'insensitive' } },
                ],
            }
            : {}),
    };
    const [items, total] = await Promise.all([
        prisma_1.prisma.chartAccount.findMany({
            where,
            skip,
            take: limit,
            orderBy: { code: 'asc' },
        }),
        prisma_1.prisma.chartAccount.count({ where }),
    ]);
    res.json({ success: true, data: (0, pagination_1.paginated)(items, total, page, limit) });
});
router.post('/accounts', auth_1.authenticate, (0, auth_1.authorize)('accounting:write'), async (req, res) => {
    const parsed = accountSchema.safeParse(req.body);
    if (!parsed.success)
        return (0, route_utils_1.validationError)(res, parsed.error.errors[0]?.message || 'Invalid account data');
    const code = (0, route_utils_1.normalizeCode)(parsed.data.code);
    const unique = await (0, route_utils_1.ensureUniqueCode)(res, () => prisma_1.prisma.chartAccount.findUnique({ where: { code }, select: { id: true, deletedAt: true } }));
    if (!unique)
        return;
    try {
        const account = await prisma_1.prisma.chartAccount.create({
            data: {
                code,
                name: parsed.data.name,
                type: parsed.data.type,
                parentId: parsed.data.parentId || null,
                isActive: parsed.data.isActive ?? true,
            },
        });
        res.status(201).json({ success: true, data: account });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to create account');
    }
});
router.put('/accounts/:id', auth_1.authenticate, (0, auth_1.authorize)('accounting:write'), async (req, res) => {
    const id = param(req.params.id);
    const parsed = accountSchema.partial().safeParse(req.body);
    if (!parsed.success)
        return (0, route_utils_1.validationError)(res, parsed.error.errors[0]?.message || 'Invalid account data');
    const code = parsed.data.code?.trim() ? (0, route_utils_1.normalizeCode)(parsed.data.code) : undefined;
    if (code) {
        const unique = await (0, route_utils_1.ensureUniqueCode)(res, () => prisma_1.prisma.chartAccount.findUnique({ where: { code }, select: { id: true, deletedAt: true } }), id);
        if (!unique)
            return;
    }
    try {
        const account = await prisma_1.prisma.chartAccount.update({
            where: { id },
            data: {
                ...parsed.data,
                ...(code ? { code } : {}),
            },
        });
        res.json({ success: true, data: account });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to update account');
    }
});
router.delete('/accounts/:id', auth_1.authenticate, (0, auth_1.authorize)('accounting:write'), async (req, res) => {
    const id = param(req.params.id);
    try {
        const account = await prisma_1.prisma.chartAccount.findUnique({ where: { id }, select: { code: true } });
        if (!account) {
            return res.status(404).json({ success: false, message: 'Not found', error: 'Not found' });
        }
        await prisma_1.prisma.chartAccount.update({
            where: { id },
            data: { deletedAt: new Date(), isActive: false, code: (0, route_utils_1.releaseCodeValue)(account.code) },
        });
        res.json({ success: true, data: null });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to delete account');
    }
});
router.get('/journal', auth_1.authenticate, (0, auth_1.authorize)('accounting:read'), async (req, res) => {
    const { page, limit, search, skip } = (0, pagination_1.getPagination)(req);
    const where = {
        ...(search
            ? {
                OR: [
                    { description: { contains: search, mode: 'insensitive' } },
                    { reference: { contains: search, mode: 'insensitive' } },
                    { entryNumber: { contains: search, mode: 'insensitive' } },
                ],
            }
            : {}),
    };
    const [items, total] = await Promise.all([
        prisma_1.prisma.journalEntry.findMany({
            where,
            skip,
            take: limit,
            include: { lines: { include: { account: true } } },
            orderBy: { date: 'desc' },
        }),
        prisma_1.prisma.journalEntry.count({ where }),
    ]);
    res.json({ success: true, data: (0, pagination_1.paginated)(items, total, page, limit) });
});
router.post('/journal', auth_1.authenticate, (0, auth_1.authorize)('accounting:write'), async (req, res) => {
    const parsed = journalSchema.safeParse(req.body);
    if (!parsed.success)
        return (0, route_utils_1.validationError)(res, parsed.error.errors[0]?.message || 'Invalid journal data');
    const totalDebit = parsed.data.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = parsed.data.lines.reduce((sum, line) => sum + line.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
        return (0, route_utils_1.validationError)(res, 'Journal entry must balance (debits must equal credits)');
    }
    try {
        const entryNumber = await generateJournalEntryNumber();
        const entry = await prisma_1.prisma.journalEntry.create({
            data: {
                entryNumber,
                description: parsed.data.description,
                reference: parsed.data.reference,
                date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
                lines: {
                    create: parsed.data.lines.map((line) => ({
                        accountId: line.accountId,
                        debit: line.debit,
                        credit: line.credit,
                        description: line.description,
                    })),
                },
            },
            include: { lines: { include: { account: true } } },
        });
        res.status(201).json({ success: true, data: entry });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to create journal entry');
    }
});
router.put('/journal/:id', auth_1.authenticate, (0, auth_1.authorize)('accounting:write'), async (req, res) => {
    const id = param(req.params.id);
    const parsed = journalSchema.safeParse(req.body);
    if (!parsed.success)
        return (0, route_utils_1.validationError)(res, parsed.error.errors[0]?.message || 'Invalid journal data');
    const totalDebit = parsed.data.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = parsed.data.lines.reduce((sum, line) => sum + line.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
        return (0, route_utils_1.validationError)(res, 'Journal entry must balance (debits must equal credits)');
    }
    try {
        await prisma_1.prisma.journalLine.deleteMany({ where: { journalEntryId: id } });
        const entry = await prisma_1.prisma.journalEntry.update({
            where: { id },
            data: {
                description: parsed.data.description,
                reference: parsed.data.reference,
                date: parsed.data.date ? new Date(parsed.data.date) : undefined,
                lines: {
                    create: parsed.data.lines.map((line) => ({
                        accountId: line.accountId,
                        debit: line.debit,
                        credit: line.credit,
                        description: line.description,
                    })),
                },
            },
            include: { lines: { include: { account: true } } },
        });
        res.json({ success: true, data: entry });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to update journal entry');
    }
});
router.delete('/journal/:id', auth_1.authenticate, (0, auth_1.authorize)('accounting:delete'), async (req, res) => {
    const id = param(req.params.id);
    try {
        await prisma_1.prisma.journalEntry.delete({ where: { id } });
        res.json({ success: true, data: null });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to delete journal entry');
    }
});
// ---------- Expenses ----------
router.get('/expenses', auth_1.authenticate, (0, auth_1.authorize)('expenses:read'), async (req, res) => {
    const { page, limit, search, skip } = (0, pagination_1.getPagination)(req);
    const category = String(req.query.category || '');
    const status = String(req.query.status || '');
    const where = {
        deletedAt: null,
        ...(category ? { category: category } : {}),
        ...(status ? { status: status } : {}),
        ...(search
            ? {
                OR: [
                    { description: { contains: search, mode: 'insensitive' } },
                    { project: { name: { contains: search, mode: 'insensitive' } } },
                ],
            }
            : {}),
    };
    const [items, total] = await Promise.all([
        prisma_1.prisma.expense.findMany({
            where,
            skip,
            take: limit,
            include: {
                project: { select: { name: true } },
                creator: { select: { firstName: true, lastName: true } },
            },
            orderBy: { expenseDate: 'desc' },
        }),
        prisma_1.prisma.expense.count({ where }),
    ]);
    res.json({ success: true, data: (0, pagination_1.paginated)(items, total, page, limit) });
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
                status: parsed.data.status || 'PENDING',
                projectId: parsed.data.projectId || null,
                accountId: parsed.data.accountId || null,
                receiptUrl: parsed.data.receiptUrl,
                creatorId: req.user.userId,
                expenseDate: parsed.data.expenseDate ? new Date(parsed.data.expenseDate) : new Date(),
            },
            include: {
                project: { select: { name: true } },
                creator: { select: { firstName: true, lastName: true } },
            },
        });
        res.status(201).json({ success: true, data: expense });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to create expense');
    }
});
router.put('/expenses/:id', auth_1.authenticate, (0, auth_1.authorize)('expenses:write'), async (req, res) => {
    const id = param(req.params.id);
    const parsed = expenseSchema.partial().safeParse(req.body);
    if (!parsed.success)
        return (0, route_utils_1.validationError)(res, parsed.error.errors[0]?.message || 'Invalid expense data');
    try {
        const expense = await prisma_1.prisma.expense.update({
            where: { id },
            data: {
                ...parsed.data,
                ...(parsed.data.expenseDate ? { expenseDate: new Date(parsed.data.expenseDate) } : {}),
                ...(parsed.data.projectId !== undefined ? { projectId: parsed.data.projectId || null } : {}),
                ...(parsed.data.accountId !== undefined ? { accountId: parsed.data.accountId || null } : {}),
            },
            include: {
                project: { select: { name: true } },
                creator: { select: { firstName: true, lastName: true } },
            },
        });
        res.json({ success: true, data: expense });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to update expense');
    }
});
router.delete('/expenses/:id', auth_1.authenticate, (0, auth_1.authorize)('expenses:write'), async (req, res) => {
    const id = param(req.params.id);
    try {
        await prisma_1.prisma.expense.update({ where: { id }, data: { deletedAt: new Date() } });
        res.json({ success: true, data: null });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to delete expense');
    }
});
router.post('/expenses/:id/approve', auth_1.authenticate, (0, auth_1.authorize)('expenses:write'), async (req, res) => {
    try {
        const expense = await (0, business_service_1.approveExpense)(param(req.params.id), req.user.userId);
        res.json({ success: true, data: expense });
    }
    catch (e) {
        res.status(400).json({ success: false, message: e.message, error: e.message });
    }
});
// ---------- Inventory ----------
router.get('/inventory', auth_1.authenticate, (0, auth_1.authorize)('inventory:read'), async (req, res) => {
    const { page, limit, search, skip } = (0, pagination_1.getPagination)(req);
    const category = String(req.query.category || '');
    const where = {
        deletedAt: null,
        ...(category ? { category } : {}),
        ...(search
            ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { sku: { contains: search, mode: 'insensitive' } },
                    { category: { contains: search, mode: 'insensitive' } },
                    { barcode: { contains: search, mode: 'insensitive' } },
                ],
            }
            : {}),
    };
    const [items, total] = await Promise.all([
        prisma_1.prisma.inventoryItem.findMany({
            where,
            skip,
            take: limit,
            orderBy: { name: 'asc' },
        }),
        prisma_1.prisma.inventoryItem.count({ where }),
    ]);
    res.json({ success: true, data: (0, pagination_1.paginated)(items, total, page, limit) });
});
router.post('/inventory', auth_1.authenticate, (0, auth_1.authorize)('inventory:write'), async (req, res) => {
    const parsed = inventorySchema.safeParse(req.body);
    if (!parsed.success)
        return (0, route_utils_1.validationError)(res, parsed.error.errors[0]?.message || 'Invalid inventory data');
    const sku = parsed.data.sku?.trim() ? (0, route_utils_1.normalizeCode)(parsed.data.sku) : await (0, route_utils_1.generateInventorySku)();
    const unique = await (0, route_utils_1.ensureUniqueCode)(res, () => prisma_1.prisma.inventoryItem.findUnique({ where: { sku }, select: { id: true, deletedAt: true } }));
    if (!unique)
        return;
    try {
        const item = await prisma_1.prisma.inventoryItem.create({ data: { ...parsed.data, sku } });
        res.status(201).json({ success: true, data: item });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to create inventory item');
    }
});
router.put('/inventory/:id', auth_1.authenticate, (0, auth_1.authorize)('inventory:write'), async (req, res) => {
    const id = param(req.params.id);
    const parsed = inventorySchema.partial().safeParse(req.body);
    if (!parsed.success)
        return (0, route_utils_1.validationError)(res, parsed.error.errors[0]?.message || 'Invalid inventory data');
    const sku = parsed.data.sku?.trim() ? (0, route_utils_1.normalizeCode)(parsed.data.sku) : undefined;
    if (sku) {
        const unique = await (0, route_utils_1.ensureUniqueCode)(res, () => prisma_1.prisma.inventoryItem.findUnique({ where: { sku }, select: { id: true, deletedAt: true } }), id);
        if (!unique)
            return;
    }
    try {
        const item = await prisma_1.prisma.inventoryItem.update({
            where: { id },
            data: {
                ...parsed.data,
                ...(sku ? { sku } : {}),
            },
        });
        res.json({ success: true, data: item });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to update inventory item');
    }
});
router.delete('/inventory/:id', auth_1.authenticate, (0, auth_1.authorize)('inventory:write'), async (req, res) => {
    const id = param(req.params.id);
    try {
        const item = await prisma_1.prisma.inventoryItem.findUnique({ where: { id }, select: { sku: true } });
        if (!item) {
            return res.status(404).json({ success: false, message: 'Not found', error: 'Not found' });
        }
        await prisma_1.prisma.inventoryItem.update({
            where: { id },
            data: { deletedAt: new Date(), sku: (0, route_utils_1.releaseCodeValue)(item.sku) },
        });
        res.json({ success: true, data: null });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to delete inventory item');
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
        res.status(400).json({ success: false, message: e.message, error: e.message });
    }
});
// ---------- Digital twin / notifications ----------
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
        orderBy: { createdAt: 'desc' },
        take: 50,
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
