import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { getPagination, paginated } from '../lib/pagination';
import { sendPrismaError, validationError } from '../lib/route-utils';

const router = Router();
const param = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : String(value || ''));

const unitSchema = z.object({
  floorId: z.string().min(1),
  unitNumber: z.string().min(1),
  unitType: z.enum(['APARTMENT', 'SHOP', 'OFFICE', 'WAREHOUSE', 'PLOT', 'PENTHOUSE']).optional(),
  area: z.coerce.number().positive(),
  price: z.coerce.number().min(0),
  status: z.enum(['AVAILABLE', 'RESERVED', 'BOOKED', 'SOLD', 'TRANSFERRED', 'UNDER_CONSTRUCTION']).optional(),
  bedrooms: z.coerce.number().optional(),
  bathrooms: z.coerce.number().optional(),
  description: z.string().optional(),
});

const buildingSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1),
  tower: z.string().optional(),
  totalFloors: z.coerce.number().min(1).default(1),
});

router.get('/units', authenticate, authorize('properties:read'), async (req, res) => {
  const { page, limit, search, skip } = getPagination(req);
  const status = String(req.query.status || '');
  const projectId = String(req.query.projectId || '');

  const where = {
    deletedAt: null,
    ...(status ? { status: status as never } : {}),
    ...(projectId ? { floor: { building: { projectId } } } : {}),
    ...(search
      ? {
          OR: [
            { unitNumber: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.unit.findMany({
      where,
      skip,
      take: limit,
      include: {
        floor: {
          include: {
            building: {
              include: { project: { select: { id: true, name: true, code: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.unit.count({ where }),
  ]);

  res.json({ success: true, data: paginated(items, total, page, limit) });
});

router.post('/units', authenticate, authorize('properties:write'), async (req, res) => {
  const parsed = unitSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error.errors[0]?.message || 'Invalid unit data');

  try {
    const unit = await prisma.unit.create({
      data: parsed.data,
      include: {
        floor: { include: { building: { include: { project: { select: { name: true, code: true } } } } } },
      },
    });
    res.status(201).json({ success: true, data: unit });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to create unit');
  }
});

router.put('/units/:id', authenticate, authorize('properties:write'), async (req, res) => {
  const id = param(req.params.id);
  const parsed = unitSchema.partial().safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error.errors[0]?.message || 'Invalid unit data');

  try {
    const unit = await prisma.unit.update({
      where: { id },
      data: parsed.data,
      include: {
        floor: { include: { building: { include: { project: { select: { name: true, code: true } } } } } },
      },
    });
    res.json({ success: true, data: unit });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to update unit');
  }
});

router.delete('/units/:id', authenticate, authorize('properties:delete'), async (req, res) => {
  const id = param(req.params.id);
  try {
    await prisma.unit.update({ where: { id }, data: { deletedAt: new Date() } });
    res.json({ success: true, data: null });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to delete unit');
  }
});

router.get('/buildings', authenticate, authorize('properties:read'), async (req, res) => {
  const { page, limit, search, skip } = getPagination(req);
  const projectId = String(req.query.projectId || '');

  const where = {
    ...(projectId ? { projectId } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { tower: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.building.findMany({
      where,
      skip,
      take: limit,
      include: {
        project: { select: { id: true, name: true, code: true } },
        floors: { include: { _count: { select: { units: true } } }, orderBy: { number: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.building.count({ where }),
  ]);

  res.json({ success: true, data: paginated(items, total, page, limit) });
});

router.post('/buildings', authenticate, authorize('properties:write'), async (req, res) => {
  const parsed = buildingSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error.errors[0]?.message || 'Invalid building data');

  try {
    const floors = Array.from({ length: parsed.data.totalFloors }, (_, i) => ({
      number: i + 1,
      name: `Floor ${i + 1}`,
    }));

    const building = await prisma.building.create({
      data: {
        projectId: parsed.data.projectId,
        name: parsed.data.name,
        tower: parsed.data.tower,
        totalFloors: parsed.data.totalFloors,
        floors: { create: floors },
      },
      include: { project: { select: { name: true, code: true } }, floors: true },
    });
    res.status(201).json({ success: true, data: building });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to create building');
  }
});

router.put('/buildings/:id', authenticate, authorize('properties:write'), async (req, res) => {
  const id = param(req.params.id);
  const parsed = buildingSchema.partial().safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error.errors[0]?.message || 'Invalid building data');

  try {
    const building = await prisma.building.update({
      where: { id },
      data: parsed.data,
      include: { project: { select: { name: true, code: true } }, floors: true },
    });
    res.json({ success: true, data: building });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to update building');
  }
});

router.delete('/buildings/:id', authenticate, authorize('properties:delete'), async (req, res) => {
  const id = param(req.params.id);
  try {
    await prisma.building.delete({ where: { id } });
    res.json({ success: true, data: null });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to delete building');
  }
});

router.get('/floors', authenticate, authorize('properties:read'), async (req, res) => {
  const buildingId = String(req.query.buildingId || '');
  const where = buildingId ? { buildingId } : {};
  const items = await prisma.floor.findMany({
    where,
    include: { building: { select: { name: true } }, _count: { select: { units: true } } },
    orderBy: { number: 'asc' },
  });
  res.json({ success: true, data: items });
});

export default router;
