import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { sendPrismaError, validationError } from '../lib/route-utils';

const router = Router();
const param = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : String(value || ''));

const machinerySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.string().min(1, 'Type is required'),
  registrationNo: z.string().optional(),
  status: z.enum(['OPERATIONAL', 'MAINTENANCE', 'REPAIR', 'IDLE', 'RETIRED']).optional(),
  purchaseDate: z.string().optional(),
  purchaseCost: z.coerce.number().optional(),
  operatorName: z.string().optional(),
  fuelCapacity: z.coerce.number().optional(),
});

router.get('/', authenticate, authorize('machinery:read'), async (_req, res) => {
  const items = await prisma.machinery.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: items });
});

router.post('/', authenticate, authorize('machinery:write'), async (req, res) => {
  const parsed = machinerySchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error.errors[0]?.message || 'Invalid machinery data');

  try {
    const machinery = await prisma.machinery.create({
      data: {
        ...parsed.data,
        purchaseDate: parsed.data.purchaseDate ? new Date(parsed.data.purchaseDate) : null,
      },
    });
    res.status(201).json({ success: true, data: machinery });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to create machinery');
  }
});

router.put('/:id', authenticate, authorize('machinery:write'), async (req, res) => {
  const id = param(req.params.id);
  const parsed = machinerySchema.partial().safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error.errors[0]?.message || 'Invalid machinery data');

  try {
    const machinery = await prisma.machinery.update({
      where: { id },
      data: {
        ...parsed.data,
        ...(parsed.data.purchaseDate ? { purchaseDate: new Date(parsed.data.purchaseDate) } : {}),
      },
    });
    res.json({ success: true, data: machinery });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to update machinery');
  }
});

router.delete('/:id', authenticate, authorize('machinery:write'), async (req, res) => {
  const id = param(req.params.id);
  try {
    await prisma.machinery.update({ where: { id }, data: { deletedAt: new Date() } });
    res.json({ success: true, data: null });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to delete machinery');
  }
});

export default router;
