import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { calculateFeasibility, mapFeasibilityToDb } from '../services/feasibility.service';
import { ensureUniqueCode, generateLandId, normalizeCode, releaseCodeValue, sendPrismaError, validationError } from '../lib/route-utils';

const router = Router();
const param = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : String(value || '');

const landSchema = z.object({
  landId: z.string().optional(),
  title: z.string().min(1),
  location: z.string().min(1),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  areaSqYards: z.coerce.number().positive(),
  areaSqFeet: z.coerce.number().positive(),
  landType: z.enum(['RESIDENTIAL', 'COMMERCIAL', 'MIXED_USE', 'INDUSTRIAL', 'AGRICULTURAL']).optional(),
  status: z.enum(['RESEARCH', 'NEGOTIATION', 'DUE_DILIGENCE', 'APPROVED', 'PURCHASED', 'REJECTED']).optional(),
  purchasePrice: z.coerce.number().optional(),
  marketPrice: z.coerce.number().optional(),
  roadWidth: z.coerce.number().optional(),
  isCornerPlot: z.boolean().optional(),
  hasElectricity: z.boolean().optional(),
  hasGas: z.boolean().optional(),
  hasWater: z.boolean().optional(),
  legalStatus: z.string().optional(),
  ownerName: z.string().optional(),
  ownerPhone: z.string().optional(),
  brokerName: z.string().optional(),
  brokerPhone: z.string().optional(),
  notes: z.string().optional(),
});

router.get('/', authenticate, authorize('land:read'), async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page || 1)));
  const limit = Math.min(100, parseInt(String(req.query.limit || 10)));
  const search = String(req.query.search || '');

  const where = {
    deletedAt: null,
    ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' as const } }, { landId: { contains: search, mode: 'insensitive' as const } }] } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.landParcel.findMany({
      where, skip: (page - 1) * limit, take: limit,
      include: { negotiations: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.landParcel.count({ where }),
  ]);
  res.json({ success: true, data: { items, total, page, limit, totalPages: Math.ceil(total / limit) } });
});

router.get('/next-id', authenticate, authorize('land:write'), async (_req, res) => {
  try {
    const landId = await generateLandId();
    res.json({ success: true, data: { landId } });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to generate land ID');
  }
});

router.get('/:id', authenticate, authorize('land:read'), async (req, res) => {
  const id = param(req.params.id);
  const land = await prisma.landParcel.findFirst({
    where: { id, deletedAt: null },
    include: { negotiations: true, documents: true, projects: true },
  });
  if (!land) return res.status(404).json({ success: false, message: 'Not found', error: 'Not found' });
  res.json({ success: true, data: land });
});

router.post('/', authenticate, authorize('land:write'), async (req, res) => {
  const parsed = landSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error.errors[0]?.message || 'Invalid land data');

  const landId = parsed.data.landId?.trim() ? normalizeCode(parsed.data.landId) : await generateLandId();
  const unique = await ensureUniqueCode(res, () =>
    prisma.landParcel.findUnique({ where: { landId }, select: { id: true, deletedAt: true } })
  );
  if (!unique) return;

  try {
    const land = await prisma.landParcel.create({ data: { ...parsed.data, landId } });
    res.status(201).json({ success: true, data: land });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to create land parcel');
  }
});

router.put('/:id', authenticate, authorize('land:write'), async (req, res) => {
  const id = param(req.params.id);
  const parsed = landSchema.partial().safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error.errors[0]?.message || 'Invalid land data');

  const landId = parsed.data.landId ? normalizeCode(parsed.data.landId) : undefined;
  if (landId) {
    const unique = await ensureUniqueCode(
      res,
      () => prisma.landParcel.findUnique({ where: { landId }, select: { id: true, deletedAt: true } }),
      id
    );
    if (!unique) return;
  }

  try {
    const land = await prisma.landParcel.update({ where: { id }, data: { ...parsed.data, ...(landId ? { landId } : {}) } });
    res.json({ success: true, data: land });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to update land parcel');
  }
});

router.delete('/:id', authenticate, authorize('land:delete'), async (req, res) => {
  const id = param(req.params.id);
  try {
    const existing = await prisma.landParcel.findUnique({ where: { id }, select: { landId: true } });
    if (!existing) return res.status(404).json({ success: false, message: 'Not found', error: 'Not found' });

    await prisma.landParcel.update({
      where: { id },
      data: { deletedAt: new Date(), landId: releaseCodeValue(existing.landId) },
    });
    res.json({ success: true, data: null });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to delete land parcel');
  }
});

router.post('/:id/feasibility', authenticate, authorize('land:feasibility'), async (req, res) => {
  const id = param(req.params.id);
  try {
    const land = await prisma.landParcel.findUnique({ where: { id } });
    if (!land) return res.status(404).json({ success: false, message: 'Land not found', error: 'Land not found' });

    const input = {
      landCost: req.body.landCost ?? Number(land.purchasePrice || land.marketPrice || 0),
      landArea: req.body.landArea ?? Number(land.areaSqFeet),
      fsi: req.body.fsi ?? 1.5,
      maxFloors: req.body.maxFloors ?? 5,
      constructionCost: req.body.constructionCost ?? 0,
      materialCost: req.body.materialCost ?? 0,
      labourCost: req.body.labourCost ?? 0,
      machineryCost: req.body.machineryCost ?? 0,
      professionalFees: req.body.professionalFees ?? 0,
      marketingCost: req.body.marketingCost ?? 0,
      financeCost: req.body.financeCost ?? 0,
      taxes: req.body.taxes ?? 0,
      contingency: req.body.contingency ?? 0,
      sellingPricePerSqFt: req.body.sellingPricePerSqFt ?? 5000,
      constructionMonths: req.body.constructionMonths,
      interestRate: req.body.interestRate,
    };

    const result = calculateFeasibility(input);
    const study = await prisma.feasibilityStudy.create({
      data: mapFeasibilityToDb(
        input, result, id,
        req.body.title || `Feasibility - ${land.title}`,
        req.body.buildingType || 'RESIDENTIAL'
      ),
    });

    res.status(201).json({ success: true, data: { ...study, calculations: result } });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to run feasibility study');
  }
});

export default router;
