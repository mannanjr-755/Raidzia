import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { getPagination, paginated } from '../lib/pagination';
import {
  ensureUniqueCode,
  generateProjectCode,
  normalizeCode,
  releaseCodeValue,
  sendPrismaError,
  validationError,
} from '../lib/route-utils';

const router = Router();
const param = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : String(value || ''));

const projectSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  location: z.string().min(1),
  city: z.string().optional(),
  clientName: z.string().optional(),
  status: z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
  budget: z.coerce.number().default(0),
  estimatedCost: z.coerce.number().default(0),
  completionPct: z.coerce.number().min(0).max(100).default(0),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  managerId: z.string().optional().nullable(),
  landParcelId: z.string().optional().nullable(),
});

router.get('/', authenticate, authorize('projects:read'), async (req, res) => {
  const { page, limit, search, skip } = getPagination(req);
  const status = String(req.query.status || '');

  const where = {
    deletedAt: null,
    ...(status ? { status: status as never } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { code: { contains: search, mode: 'insensitive' as const } },
            { location: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.project.findMany({
      where,
      skip,
      take: limit,
      include: { manager: { select: { firstName: true, lastName: true } }, landParcel: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.project.count({ where }),
  ]);

  res.json({ success: true, data: paginated(items, total, page, limit) });
});

router.get('/next-code', authenticate, authorize('projects:write'), async (_req, res) => {
  try {
    const code = await generateProjectCode();
    res.json({ success: true, data: { code } });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to generate project code');
  }
});

router.get('/:id', authenticate, authorize('projects:read'), async (req, res) => {
  const id = param(req.params.id);

  const project = await prisma.project.findFirst({
    where: { id, deletedAt: null },
    include: {
      manager: true,
      landParcel: true,
      milestones: true,
      tasks: true,
      progressLogs: { orderBy: { date: 'desc' }, take: 10 },
      buildings: { include: { floors: { include: { units: true } } } },
      expenses: { where: { deletedAt: null }, take: 10 },
    },
  });
  if (!project) return res.status(404).json({ success: false, message: 'Not found', error: 'Not found' });
  res.json({ success: true, data: project });
});

router.post('/', authenticate, authorize('projects:write'), async (req, res) => {
  const parsed = projectSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error.errors[0]?.message || 'Invalid project data');

  const code = parsed.data.code?.trim()
    ? normalizeCode(parsed.data.code)
    : await generateProjectCode();

  const unique = await ensureUniqueCode(res, () =>
    prisma.project.findUnique({ where: { code }, select: { id: true, deletedAt: true } })
  );
  if (!unique) return;

  const data = {
    ...parsed.data,
    code,
    startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
    endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
  };

  try {
    const project = await prisma.project.create({ data });
    await prisma.activityLog.create({
      data: { userId: req.user!.userId, action: 'CREATE', entity: 'Project', entityId: project.id },
    });
    res.status(201).json({ success: true, data: project });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to create project');
  }
});

router.put('/:id', authenticate, authorize('projects:write'), async (req, res) => {
  const id = param(req.params.id);
  const parsed = projectSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error.errors[0]?.message || 'Invalid project data');

  const code = parsed.data.code?.trim()
    ? normalizeCode(parsed.data.code)
    : await generateProjectCode();

  const unique = await ensureUniqueCode(
    res,
    () => prisma.project.findUnique({ where: { code }, select: { id: true, deletedAt: true } }),
    id
  );
  if (!unique) return;

  const data = {
    ...parsed.data,
    code,
    startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
    endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
  };

  try {
    const project = await prisma.project.update({ where: { id }, data });
    res.json({ success: true, data: project });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to update project');
  }
});

router.delete('/:id', authenticate, authorize('projects:delete'), async (req, res) => {
  const id = param(req.params.id);
  try {
    const project = await prisma.project.findUnique({ where: { id }, select: { code: true } });
    if (!project) return res.status(404).json({ success: false, message: 'Not found', error: 'Not found' });

    await prisma.project.update({
      where: { id },
      data: { deletedAt: new Date(), code: releaseCodeValue(project.code) },
    });
    res.json({ success: true, data: null });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to delete project');
  }
});

router.post('/:id/milestones', authenticate, authorize('projects:write'), async (req, res) => {
  const id = param(req.params.id);
  try {
    const milestone = await prisma.projectMilestone.create({
      data: {
        projectId: id,
        title: req.body.title,
        description: req.body.description,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
      },
    });
    res.status(201).json({ success: true, data: milestone });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to create milestone');
  }
});

router.post('/:id/progress', authenticate, authorize('projects:write'), async (req, res) => {
  const id = param(req.params.id);
  try {
    const log = await prisma.dailyProgress.create({
      data: {
        projectId: id,
        description: req.body.description,
        workDone: req.body.workDone,
        labourCount: req.body.labourCount || 0,
        weather: req.body.weather,
        photos: req.body.photos || [],
      },
    });
    if (req.body.completionPct !== undefined) {
      await prisma.project.update({
        where: { id },
        data: { completionPct: req.body.completionPct, actualCost: { increment: req.body.costAdded || 0 } },
      });
    }
    res.status(201).json({ success: true, data: log });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to save progress');
  }
});

export default router;
