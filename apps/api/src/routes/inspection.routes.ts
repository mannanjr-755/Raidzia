import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { sendPrismaError, validationError } from '../lib/route-utils';

const router = Router();
const param = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : String(value || ''));

const inspectionSchema = z.object({
  projectId: z.string().min(1, 'Project is required'),
  title: z.string().min(1, 'Title is required'),
  type: z.string().default('QUALITY'),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']).optional(),
  date: z.string().optional(),
  notes: z.string().optional(),
});

router.get('/', authenticate, authorize('inspection:read'), async (_req, res) => {
  const items = await prisma.inspection.findMany({
    include: { project: { select: { name: true, code: true } }, inspector: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ success: true, data: items });
});

router.post('/', authenticate, authorize('inspection:write'), async (req, res) => {
  const parsed = inspectionSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error.errors[0]?.message || 'Invalid inspection data');

  try {
    const inspection = await prisma.inspection.create({
      data: {
        ...parsed.data,
        inspectorId: req.user!.userId,
        date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
      },
      include: { project: { select: { name: true, code: true } } },
    });
    res.status(201).json({ success: true, data: inspection });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to create inspection');
  }
});

router.put('/:id', authenticate, authorize('inspection:write'), async (req, res) => {
  const id = param(req.params.id);
  const parsed = inspectionSchema.partial().safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error.errors[0]?.message || 'Invalid inspection data');

  try {
    const inspection = await prisma.inspection.update({
      where: { id },
      data: {
        ...parsed.data,
        ...(parsed.data.date ? { date: new Date(parsed.data.date) } : {}),
      },
      include: { project: { select: { name: true, code: true } } },
    });
    res.json({ success: true, data: inspection });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to update inspection');
  }
});

router.delete('/:id', authenticate, authorize('inspection:write'), async (req, res) => {
  const id = param(req.params.id);
  try {
    await prisma.inspection.delete({ where: { id } });
    res.json({ success: true, data: null });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to delete inspection');
  }
});

export default router;
