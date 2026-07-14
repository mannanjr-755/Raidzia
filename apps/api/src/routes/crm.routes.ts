import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { getPagination, paginated } from '../lib/pagination';
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
  customerId: z.string().optional().nullable(),
  nextFollowUp: z.string().optional().nullable(),
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

const bookingSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  unitId: z.string().min(1, 'Unit is required'),
  totalAmount: z.coerce.number().positive('Total amount is required'),
  downPayment: z.coerce.number().min(0).optional(),
  discount: z.coerce.number().min(0).optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']).optional(),
  notes: z.string().optional(),
  possessionDate: z.string().optional().nullable(),
});

// ---------- Leads ----------

router.get('/leads', authenticate, authorize('crm:read'), async (req, res) => {
  const { page, limit, search, skip } = getPagination(req);
  const status = String(req.query.status || '');

  const where = {
    deletedAt: null,
    ...(status ? { status: status as never } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { interest: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      skip,
      take: limit,
      include: {
        assignee: { select: { firstName: true, lastName: true } },
        customer: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.lead.count({ where }),
  ]);

  res.json({ success: true, data: paginated(items, total, page, limit) });
});

router.post('/leads', authenticate, authorize('crm:write'), async (req, res) => {
  const parsed = leadSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error.errors[0]?.message || 'Invalid lead data');

  try {
    const lead = await prisma.lead.create({
      data: {
        ...parsed.data,
        assigneeId: req.user!.userId,
        nextFollowUp: parsed.data.nextFollowUp ? new Date(parsed.data.nextFollowUp) : undefined,
      },
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
      data: {
        ...parsed.data,
        ...(parsed.data.nextFollowUp !== undefined
          ? { nextFollowUp: parsed.data.nextFollowUp ? new Date(parsed.data.nextFollowUp) : null }
          : {}),
      },
      include: { assignee: { select: { firstName: true, lastName: true } } },
    });
    res.json({ success: true, data: lead });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to update lead');
  }
});

router.delete('/leads/:id', authenticate, authorize('crm:write'), async (req, res) => {
  const id = param(req.params.id);
  try {
    await prisma.lead.update({ where: { id }, data: { deletedAt: new Date() } });
    res.json({ success: true, data: null });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to delete lead');
  }
});

// ---------- Customers ----------

router.get('/customers', authenticate, authorize('crm:read'), async (req, res) => {
  const { page, limit, search, skip } = getPagination(req);

  const where = {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { cnic: { contains: search, mode: 'insensitive' as const } },
            { city: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: 'asc' },
    }),
    prisma.customer.count({ where }),
  ]);

  res.json({ success: true, data: paginated(items, total, page, limit) });
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

router.put('/customers/:id', authenticate, authorize('crm:write'), async (req, res) => {
  const id = param(req.params.id);
  const parsed = customerSchema.partial().safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error.errors[0]?.message || 'Invalid customer data');

  try {
    const customer = await prisma.customer.update({ where: { id }, data: parsed.data });
    res.json({ success: true, data: customer });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to update customer');
  }
});

router.delete('/customers/:id', authenticate, authorize('crm:write'), async (req, res) => {
  const id = param(req.params.id);
  try {
    await prisma.customer.update({ where: { id }, data: { deletedAt: new Date() } });
    res.json({ success: true, data: null });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to delete customer');
  }
});

// ---------- Bookings ----------

router.get('/bookings', authenticate, authorize('sales:read'), async (req, res) => {
  const { page, limit, search, skip } = getPagination(req);
  const status = String(req.query.status || '');

  const where = {
    deletedAt: null,
    ...(status ? { status: status as never } : {}),
    ...(search
      ? {
          OR: [
            { bookingNumber: { contains: search, mode: 'insensitive' as const } },
            { notes: { contains: search, mode: 'insensitive' as const } },
            { customer: { name: { contains: search, mode: 'insensitive' as const } } },
            { customer: { phone: { contains: search, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      skip,
      take: limit,
      include: {
        customer: true,
        unit: { include: { floor: { include: { building: { include: { project: true } } } } } },
        installments: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.booking.count({ where }),
  ]);

  res.json({ success: true, data: paginated(items, total, page, limit) });
});

router.post('/bookings', authenticate, authorize('sales:write'), async (req, res) => {
  const parsed = bookingSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error.errors[0]?.message || 'Invalid booking data');

  try {
    const count = await prisma.booking.count();
    const booking = await prisma.booking.create({
      data: {
        bookingNumber: `BK-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
        customerId: parsed.data.customerId,
        unitId: parsed.data.unitId,
        salesAgentId: req.user!.userId,
        totalAmount: parsed.data.totalAmount,
        downPayment: parsed.data.downPayment || 0,
        discount: parsed.data.discount || 0,
        status: parsed.data.status || 'PENDING',
        notes: parsed.data.notes,
        possessionDate: parsed.data.possessionDate ? new Date(parsed.data.possessionDate) : null,
      },
      include: { customer: true, unit: true },
    });
    await prisma.unit.update({ where: { id: parsed.data.unitId }, data: { status: 'RESERVED' } });
    res.status(201).json({ success: true, data: booking });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to create booking');
  }
});

router.put('/bookings/:id', authenticate, authorize('sales:write'), async (req, res) => {
  const id = param(req.params.id);
  const parsed = bookingSchema.partial().safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error.errors[0]?.message || 'Invalid booking data');

  try {
    const booking = await prisma.booking.update({
      where: { id },
      data: {
        ...parsed.data,
        ...(parsed.data.possessionDate !== undefined
          ? { possessionDate: parsed.data.possessionDate ? new Date(parsed.data.possessionDate) : null }
          : {}),
      },
      include: { customer: true, unit: true, installments: true },
    });
    res.json({ success: true, data: booking });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to update booking');
  }
});

router.delete('/bookings/:id', authenticate, authorize('sales:write'), async (req, res) => {
  const id = param(req.params.id);
  try {
    const booking = await prisma.booking.findUnique({ where: { id }, select: { unitId: true } });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Not found', error: 'Not found' });
    }

    await prisma.$transaction([
      prisma.booking.update({ where: { id }, data: { deletedAt: new Date(), status: 'CANCELLED' } }),
      prisma.unit.update({ where: { id: booking.unitId }, data: { status: 'AVAILABLE' } }),
    ]);

    res.json({ success: true, data: null });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to delete booking');
  }
});

router.post('/bookings/:id/confirm', authenticate, authorize('sales:write'), async (req, res) => {
  try {
    const booking = await confirmBooking(param(req.params.id), req.user!.userId);
    res.json({ success: true, data: booking });
  } catch (e) {
    res.status(400).json({ success: false, message: (e as Error).message, error: (e as Error).message });
  }
});

export default router;
