import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { getPagination, paginated } from '../lib/pagination';
import { approveExpense, stockOut } from '../services/business.service';
import {
  ensureUniqueCode,
  generateInventorySku,
  normalizeCode,
  releaseCodeValue,
  sendPrismaError,
  validationError,
} from '../lib/route-utils';

const router = Router();
const param = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : String(value || '');

const expenseCategoryEnum = z.enum([
  'FUEL', 'ELECTRICITY', 'WATER', 'CONSTRUCTION', 'LABOUR', 'MATERIAL',
  'EQUIPMENT', 'OFFICE', 'MARKETING', 'TRANSPORT', 'UTILITIES', 'MAINTENANCE', 'OTHER',
]);

const expenseStatusEnum = z.enum(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PAID']);

const expenseSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  category: expenseCategoryEnum.default('OTHER'),
  status: expenseStatusEnum.optional(),
  expenseDate: z.string().optional(),
  projectId: z.string().optional().nullable(),
  accountId: z.string().optional().nullable(),
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
  barcode: z.string().optional(),
  warehouse: z.string().optional(),
});

const stockSchema = z.object({
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
  notes: z.string().optional(),
});

const accountTypeEnum = z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']);

const accountSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  type: accountTypeEnum,
  parentId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

const journalLineSchema = z.object({
  accountId: z.string().min(1),
  debit: z.coerce.number().min(0).default(0),
  credit: z.coerce.number().min(0).default(0),
  description: z.string().optional(),
});

const journalSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  reference: z.string().optional(),
  date: z.string().optional(),
  lines: z.array(journalLineSchema).min(1, 'At least one journal line is required'),
});

async function generateJournalEntryNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `JE-${year}-`;
  const latest = await prisma.journalEntry.findFirst({
    where: { entryNumber: { startsWith: prefix } },
    orderBy: { entryNumber: 'desc' },
    select: { entryNumber: true },
  });

  let next = 1;
  if (latest?.entryNumber) {
    const tail = parseInt(latest.entryNumber.slice(prefix.length), 10);
    if (!Number.isNaN(tail)) next = tail + 1;
  }

  return `${prefix}${String(next).padStart(4, '0')}`;
}

// ---------- Accounting ----------

router.get('/accounts', authenticate, authorize('accounting:read'), async (req, res) => {
  const { page, limit, search, skip } = getPagination(req);
  const type = String(req.query.type || '');

  const where = {
    deletedAt: null,
    ...(type ? { type: type as never } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { code: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.chartAccount.findMany({
      where,
      skip,
      take: limit,
      orderBy: { code: 'asc' },
    }),
    prisma.chartAccount.count({ where }),
  ]);

  res.json({ success: true, data: paginated(items, total, page, limit) });
});

router.post('/accounts', authenticate, authorize('accounting:write'), async (req, res) => {
  const parsed = accountSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error.errors[0]?.message || 'Invalid account data');

  const code = normalizeCode(parsed.data.code);
  const unique = await ensureUniqueCode(res, () =>
    prisma.chartAccount.findUnique({ where: { code }, select: { id: true, deletedAt: true } })
  );
  if (!unique) return;

  try {
    const account = await prisma.chartAccount.create({
      data: {
        code,
        name: parsed.data.name,
        type: parsed.data.type,
        parentId: parsed.data.parentId || null,
        isActive: parsed.data.isActive ?? true,
      },
    });
    res.status(201).json({ success: true, data: account });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to create account');
  }
});

router.put('/accounts/:id', authenticate, authorize('accounting:write'), async (req, res) => {
  const id = param(req.params.id);
  const parsed = accountSchema.partial().safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error.errors[0]?.message || 'Invalid account data');

  const code = parsed.data.code?.trim() ? normalizeCode(parsed.data.code) : undefined;
  if (code) {
    const unique = await ensureUniqueCode(
      res,
      () => prisma.chartAccount.findUnique({ where: { code }, select: { id: true, deletedAt: true } }),
      id
    );
    if (!unique) return;
  }

  try {
    const account = await prisma.chartAccount.update({
      where: { id },
      data: {
        ...parsed.data,
        ...(code ? { code } : {}),
      },
    });
    res.json({ success: true, data: account });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to update account');
  }
});

router.delete('/accounts/:id', authenticate, authorize('accounting:write'), async (req, res) => {
  const id = param(req.params.id);
  try {
    const account = await prisma.chartAccount.findUnique({ where: { id }, select: { code: true } });
    if (!account) {
      return res.status(404).json({ success: false, message: 'Not found', error: 'Not found' });
    }

    await prisma.chartAccount.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, code: releaseCodeValue(account.code) },
    });
    res.json({ success: true, data: null });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to delete account');
  }
});

router.get('/journal', authenticate, authorize('accounting:read'), async (req, res) => {
  const { page, limit, search, skip } = getPagination(req);

  const where = {
    ...(search
      ? {
          OR: [
            { description: { contains: search, mode: 'insensitive' as const } },
            { reference: { contains: search, mode: 'insensitive' as const } },
            { entryNumber: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.journalEntry.findMany({
      where,
      skip,
      take: limit,
      include: { lines: { include: { account: true } } },
      orderBy: { date: 'desc' },
    }),
    prisma.journalEntry.count({ where }),
  ]);

  res.json({ success: true, data: paginated(items, total, page, limit) });
});

router.post('/journal', authenticate, authorize('accounting:write'), async (req, res) => {
  const parsed = journalSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error.errors[0]?.message || 'Invalid journal data');

  const totalDebit = parsed.data.lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = parsed.data.lines.reduce((sum, line) => sum + line.credit, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    return validationError(res, 'Journal entry must balance (debits must equal credits)');
  }

  try {
    const entryNumber = await generateJournalEntryNumber();
    const entry = await prisma.journalEntry.create({
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
  } catch (error) {
    sendPrismaError(res, error, 'Failed to create journal entry');
  }
});

router.put('/journal/:id', authenticate, authorize('accounting:write'), async (req, res) => {
  const id = param(req.params.id);
  const parsed = journalSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error.errors[0]?.message || 'Invalid journal data');

  const totalDebit = parsed.data.lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = parsed.data.lines.reduce((sum, line) => sum + line.credit, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    return validationError(res, 'Journal entry must balance (debits must equal credits)');
  }

  try {
    await prisma.journalLine.deleteMany({ where: { journalEntryId: id } });
    const entry = await prisma.journalEntry.update({
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
  } catch (error) {
    sendPrismaError(res, error, 'Failed to update journal entry');
  }
});

router.delete('/journal/:id', authenticate, authorize('accounting:delete'), async (req, res) => {
  const id = param(req.params.id);
  try {
    await prisma.journalEntry.delete({ where: { id } });
    res.json({ success: true, data: null });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to delete journal entry');
  }
});

// ---------- Expenses ----------

router.get('/expenses', authenticate, authorize('expenses:read'), async (req, res) => {
  const { page, limit, search, skip } = getPagination(req);
  const category = String(req.query.category || '');
  const status = String(req.query.status || '');

  const where = {
    deletedAt: null,
    ...(category ? { category: category as never } : {}),
    ...(status ? { status: status as never } : {}),
    ...(search
      ? {
          OR: [
            { description: { contains: search, mode: 'insensitive' as const } },
            { project: { name: { contains: search, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      skip,
      take: limit,
      include: {
        project: { select: { name: true } },
        creator: { select: { firstName: true, lastName: true } },
      },
      orderBy: { expenseDate: 'desc' },
    }),
    prisma.expense.count({ where }),
  ]);

  res.json({ success: true, data: paginated(items, total, page, limit) });
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
        status: parsed.data.status || 'PENDING',
        projectId: parsed.data.projectId || null,
        accountId: parsed.data.accountId || null,
        receiptUrl: parsed.data.receiptUrl,
        creatorId: req.user!.userId,
        expenseDate: parsed.data.expenseDate ? new Date(parsed.data.expenseDate) : new Date(),
      },
      include: {
        project: { select: { name: true } },
        creator: { select: { firstName: true, lastName: true } },
      },
    });
    res.status(201).json({ success: true, data: expense });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to create expense');
  }
});

router.put('/expenses/:id', authenticate, authorize('expenses:write'), async (req, res) => {
  const id = param(req.params.id);
  const parsed = expenseSchema.partial().safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error.errors[0]?.message || 'Invalid expense data');

  try {
    const expense = await prisma.expense.update({
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
  } catch (error) {
    sendPrismaError(res, error, 'Failed to update expense');
  }
});

router.delete('/expenses/:id', authenticate, authorize('expenses:write'), async (req, res) => {
  const id = param(req.params.id);
  try {
    await prisma.expense.update({ where: { id }, data: { deletedAt: new Date() } });
    res.json({ success: true, data: null });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to delete expense');
  }
});

router.post('/expenses/:id/approve', authenticate, authorize('expenses:write'), async (req, res) => {
  try {
    const expense = await approveExpense(param(req.params.id), req.user!.userId);
    res.json({ success: true, data: expense });
  } catch (e) {
    res.status(400).json({ success: false, message: (e as Error).message, error: (e as Error).message });
  }
});

// ---------- Inventory ----------

router.get('/inventory', authenticate, authorize('inventory:read'), async (req, res) => {
  const { page, limit, search, skip } = getPagination(req);
  const category = String(req.query.category || '');

  const where = {
    deletedAt: null,
    ...(category ? { category } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { sku: { contains: search, mode: 'insensitive' as const } },
            { category: { contains: search, mode: 'insensitive' as const } },
            { barcode: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: 'asc' },
    }),
    prisma.inventoryItem.count({ where }),
  ]);

  res.json({ success: true, data: paginated(items, total, page, limit) });
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

router.put('/inventory/:id', authenticate, authorize('inventory:write'), async (req, res) => {
  const id = param(req.params.id);
  const parsed = inventorySchema.partial().safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error.errors[0]?.message || 'Invalid inventory data');

  const sku = parsed.data.sku?.trim() ? normalizeCode(parsed.data.sku) : undefined;
  if (sku) {
    const unique = await ensureUniqueCode(
      res,
      () => prisma.inventoryItem.findUnique({ where: { sku }, select: { id: true, deletedAt: true } }),
      id
    );
    if (!unique) return;
  }

  try {
    const item = await prisma.inventoryItem.update({
      where: { id },
      data: {
        ...parsed.data,
        ...(sku ? { sku } : {}),
      },
    });
    res.json({ success: true, data: item });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to update inventory item');
  }
});

router.delete('/inventory/:id', authenticate, authorize('inventory:write'), async (req, res) => {
  const id = param(req.params.id);
  try {
    const item = await prisma.inventoryItem.findUnique({ where: { id }, select: { sku: true } });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Not found', error: 'Not found' });
    }

    await prisma.inventoryItem.update({
      where: { id },
      data: { deletedAt: new Date(), sku: releaseCodeValue(item.sku) },
    });
    res.json({ success: true, data: null });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to delete inventory item');
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
    res.status(400).json({ success: false, message: (e as Error).message, error: (e as Error).message });
  }
});

// ---------- Digital twin / notifications ----------

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
    orderBy: { createdAt: 'desc' },
    take: 50,
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
