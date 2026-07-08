import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { confirmBooking } from '../services/business.service';
import { sendPrismaError, validationError } from '../lib/route-utils';

const router = Router();
const param = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : String(value || '');

const leadSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().email().optional().or(z.literal('')).transform((v) => v || undefined),
  source: z.string().optional(),
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'NEGOTIATION', 'WON', 'LOST']).optional(),
  budget: z.coerce.number().optional(),
  interest: z.string().optional(),
  notes: z.string().optional(),
});

const customerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().email().optional().or(z.literal('')).transform((v) => v || undefined),
  cnic: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
});

router.get('/bookings', authenticate, authorize('sales:read'), async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page || 1)));
  const limit = Math.min(100, parseInt(String(req.query.limit || 10)));
  const [items, total] = await Promise.all([
    prisma.booking.findMany({
      where: { deletedAt: null },
      include: { customer: true, unit: { include: { floor: { include: { building: { include: { project: true } } } } } }, installments: true },
      skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
    }),
    prisma.booking.count({ where: { deletedAt: null } }),
  ]);
  res.json({ success: true, data: { items, total, page, limit, totalPages: Math.ceil(total / limit) } });
});

router.post('/bookings', authenticate, authorize('sales:write'), async (req, res) => {
  try {
    const count = await prisma.booking.count();
    const booking = await prisma.booking.create({
      data: {
        bookingNumber: `BK-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
        customerId: req.body.customerId,
        unitId: req.body.unitId,
        salesAgentId: req.user!.userId,
        totalAmount: req.body.totalAmount,
        downPayment: req.body.downPayment || 0,
        discount: req.body.discount || 0,
        status: 'PENDING',
        notes: req.body.notes,
      },
      include: { customer: true, unit: true },
    });
    await prisma.unit.update({ where: { id: req.body.unitId }, data: { status: 'RESERVED' } });
    res.status(201).json({ success: true, data: booking });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to create booking');
  }
});

router.post('/bookings/:id/confirm', authenticate, authorize('sales:write'), async (req, res) => {
  try {
    const booking = await confirmBooking(param(req.params.id), req.user!.userId);
    res.json({ success: true, data: booking });
  } catch (e) {
    res.status(400).json({ success: false, error: (e as Error).message });
  }
});

router.get('/leads', authenticate, authorize('crm:read'), async (_req, res) => {
  const items = await prisma.lead.findMany({
    where: { deletedAt: null },
    include: { assignee: { select: { firstName: true, lastName: true } }, customer: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: items });
});

router.post('/leads', authenticate, authorize('crm:write'), async (req, res) => {
  const parsed = leadSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error.errors[0]?.message || 'Invalid lead data');

  try {
    const lead = await prisma.lead.create({
      data: { ...parsed.data, assigneeId: req.user!.userId },
      include: { assignee: { select: { firstName: true, lastName: true } } },
    });
    res.status(201).json({ success: true, data: lead });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to create lead');
  }
});

router.put('/leads/:id', authenticate, authorize('crm:write'), async (req, res) => {
  const id = param(req.params.id);
  const parsed = leadSchema.partial().safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error.errors[0]?.message || 'Invalid lead data');

  try {
    const lead = await prisma.lead.update({
      where: { id },
      data: parsed.data,
      include: { assignee: { select: { firstName: true, lastName: true } } },
    });
    res.json({ success: true, data: lead });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to update lead');
  }
});

router.get('/customers', authenticate, authorize('crm:read'), async (_req, res) => {
  const items = await prisma.customer.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } });
  res.json({ success: true, data: items });
});

router.post('/customers', authenticate, authorize('crm:write'), async (req, res) => {
  const parsed = customerSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error.errors[0]?.message || 'Invalid customer data');

  try {
    const customer = await prisma.customer.create({ data: parsed.data });
    res.status(201).json({ success: true, data: customer });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to create customer');
  }
});

export default router;
