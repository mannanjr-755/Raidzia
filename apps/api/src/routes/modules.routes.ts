import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { approveExpense, stockOut } from '../services/business.service';
import {
  ensureUniqueCode,
  generateInventorySku,
  normalizeCode,
  sendPrismaError,
  validationError,
} from '../lib/route-utils';

const router = Router();
const param = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : String(value || '');

const expenseCategoryEnum = z.enum([
  'FUEL', 'ELECTRICITY', 'WATER', 'CONSTRUCTION', 'LABOUR', 'MATERIAL',
  'EQUIPMENT', 'OFFICE', 'MARKETING', 'TRANSPORT', 'UTILITIES', 'MAINTENANCE', 'OTHER',
]);

const expenseSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  category: expenseCategoryEnum.default('OTHER'),
  expenseDate: z.string().optional(),
  projectId: z.string().optional().nullable(),
  receiptUrl: z.string().optional(),
});

const inventorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  sku: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  unit: z.string().min(1).default('pcs'),
  quantity: z.coerce.number().min(0).default(0),
  minStock: z.coerce.number().min(0).default(0),
  unitCost: z.coerce.number().min(0).default(0),
});

const stockSchema = z.object({
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
  notes: z.string().optional(),
});

router.get('/accounts', authenticate, authorize('accounting:read'), async (_req, res) => {
  const items = await prisma.chartAccount.findMany({ where: { deletedAt: null }, orderBy: { code: 'asc' } });
  res.json({ success: true, data: items });
});

router.get('/journal', authenticate, authorize('accounting:read'), async (_req, res) => {
  const items = await prisma.journalEntry.findMany({
    include: { lines: { include: { account: true } } },
    orderBy: { date: 'desc' }, take: 50,
  });
  res.json({ success: true, data: items });
});

router.get('/expenses', authenticate, authorize('expenses:read'), async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page || 1)));
  const limit = Math.min(100, parseInt(String(req.query.limit || 10)));
  const [items, total] = await Promise.all([
    prisma.expense.findMany({
      where: { deletedAt: null },
      include: { project: { select: { name: true } }, creator: { select: { firstName: true, lastName: true } } },
      skip: (page - 1) * limit, take: limit, orderBy: { expenseDate: 'desc' },
    }),
    prisma.expense.count({ where: { deletedAt: null } }),
  ]);
  res.json({ success: true, data: { items, total, page, limit, totalPages: Math.ceil(total / limit) } });
});

router.post('/expenses', authenticate, authorize('expenses:write'), async (req, res) => {
  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error.errors[0]?.message || 'Invalid expense data');

  try {
    const expense = await prisma.expense.create({
      data: {
        description: parsed.data.description,
        amount: parsed.data.amount,
        category: parsed.data.category,
        projectId: parsed.data.projectId || null,
        receiptUrl: parsed.data.receiptUrl,
        creatorId: req.user!.userId,
        expenseDate: parsed.data.expenseDate ? new Date(parsed.data.expenseDate) : new Date(),
      },
      include: { project: { select: { name: true } }, creator: { select: { firstName: true, lastName: true } } },
    });
    res.status(201).json({ success: true, data: expense });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to create expense');
  }
});

router.post('/expenses/:id/approve', authenticate, authorize('expenses:write'), async (req, res) => {
  try {
    const expense = await approveExpense(param(req.params.id), req.user!.userId);
    res.json({ success: true, data: expense });
  } catch (e) {
    res.status(400).json({ success: false, error: (e as Error).message });
  }
});

router.get('/inventory', authenticate, authorize('inventory:read'), async (_req, res) => {
  const items = await prisma.inventoryItem.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } });
  res.json({ success: true, data: items });
});

router.post('/inventory', authenticate, authorize('inventory:write'), async (req, res) => {
  const parsed = inventorySchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error.errors[0]?.message || 'Invalid inventory data');

  const sku = parsed.data.sku?.trim() ? normalizeCode(parsed.data.sku) : await generateInventorySku();
  const unique = await ensureUniqueCode(res, () =>
    prisma.inventoryItem.findUnique({ where: { sku }, select: { id: true, deletedAt: true } })
  );
  if (!unique) return;

  try {
    const item = await prisma.inventoryItem.create({ data: { ...parsed.data, sku } });
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to create inventory item');
  }
});

router.post('/inventory/:id/stock-in', authenticate, authorize('inventory:write'), async (req, res) => {
  const id = param(req.params.id);
  const parsed = stockSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error.errors[0]?.message || 'Invalid stock data');

  try {
    await prisma.$transaction([
      prisma.inventoryItem.update({
        where: { id },
        data: { quantity: { increment: parsed.data.quantity } },
      }),
      prisma.stockMovement.create({
        data: {
          inventoryItemId: id,
          type: 'IN',
          quantity: parsed.data.quantity,
          notes: parsed.data.notes,
        },
      }),
    ]);
    const item = await prisma.inventoryItem.findUnique({ where: { id } });
    res.json({ success: true, data: item });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to add stock');
  }
});

router.post('/inventory/:id/stock-out', authenticate, authorize('inventory:write'), async (req, res) => {
  const parsed = stockSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error.errors[0]?.message || 'Invalid stock data');

  try {
    const item = await stockOut(param(req.params.id), parsed.data.quantity, req.body.projectId, parsed.data.notes);
    res.json({ success: true, data: item });
  } catch (e) {
    res.status(400).json({ success: false, error: (e as Error).message });
  }
});

router.get('/properties/digital-twin/:projectId', authenticate, authorize('digital-twin:read'), async (req, res) => {
  const projectId = param(req.params.projectId);
  const buildings = await prisma.building.findMany({
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

router.get('/notifications', authenticate, authorize('notifications:read'), async (req, res) => {
  const items = await prisma.notification.findMany({
    where: { userId: req.user!.userId },
    orderBy: { createdAt: 'desc' }, take: 50,
  });
  res.json({ success: true, data: items });
});

router.patch('/notifications/:id/read', authenticate, authorize('notifications:read'), async (req, res) => {
  const id = param(req.params.id);
  try {
    await prisma.notification.updateMany({
      where: { id, userId: req.user!.userId },
      data: { isRead: true },
    });
    res.json({ success: true, data: null });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to update notification');
  }
});

export default router;
