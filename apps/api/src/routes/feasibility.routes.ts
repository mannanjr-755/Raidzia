import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { getPagination, paginated } from '../lib/pagination';
import { sendPrismaError, validationError } from '../lib/route-utils';
import { calculateProjectFeasibility } from '../services/feasibility.service';
import { toNum } from '../lib/auth';

const router = Router();
const param = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : String(value || ''));

const costItemSchema = z.object({
  category: z.string().min(1),
  subCategory: z.string().optional().nullable(),
  amount: z.coerce.number().min(0),
  isDirect: z.boolean().optional().default(true),
});

const revenueItemSchema = z.object({
  category: z.string().min(1),
  amount: z.coerce.number().min(0),
});

const studySchema = z.object({
  projectName: z.string().min(1),
  clientName: z.string().optional().nullable(),
  projectType: z.string().min(1),
  projectLocation: z.string().min(1),
  areaSqFt: z.coerce.number().min(0).default(0),
  areaSqM: z.coerce.number().min(0).default(0),
  projectDurationMonths: z.coerce.number().int().min(0).default(0),
  estimatedStartDate: z.string().optional().nullable(),
  estimatedCompletionDate: z.string().optional().nullable(),
  currency: z.string().min(1).default('PKR'),
  taxPercentage: z.coerce.number().min(0).default(0),
  contingencyPercentage: z.coerce.number().min(0).default(0),
  expectedProfitMargin: z.coerce.number().min(0).default(0),
  notes: z.string().optional().nullable(),
  contractValue: z.coerce.number().min(0).default(0),
  variationOrders: z.coerce.number().min(0).default(0),
  additionalIncome: z.coerce.number().min(0).default(0),
  retentionRelease: z.coerce.number().min(0).default(0),
  otherRevenue: z.coerce.number().min(0).default(0),
  costs: z.array(costItemSchema).default([]),
  revenues: z.array(revenueItemSchema).default([]),
});

function withMetrics(study: any) {
  const metrics = calculateProjectFeasibility({
    areaSqFt: toNum(study.areaSqFt),
    areaSqM: toNum(study.areaSqM),
    projectDurationMonths: study.projectDurationMonths,
    taxPercentage: toNum(study.taxPercentage),
    contingencyPercentage: toNum(study.contingencyPercentage),
    expectedProfitMargin: toNum(study.expectedProfitMargin),
    contractValue: toNum(study.contractValue),
    variationOrders: toNum(study.variationOrders),
    additionalIncome: toNum(study.additionalIncome),
    retentionRelease: toNum(study.retentionRelease),
    otherRevenue: toNum(study.otherRevenue),
    archivedAt: study.archivedAt,
    costs: study.costs.map((item: any) => ({ amount: toNum(item.amount), isDirect: item.isDirect })),
    revenues: study.revenues.map((item: any) => ({ amount: toNum(item.amount) })),
  });
  return { ...study, calculations: metrics };
}

router.get('/', authenticate, authorize('feasibility:read'), async (req, res) => {
  const { page, limit, search, skip } = getPagination(req);
  const status = String(req.query.status || '');
  const projectType = String(req.query.projectType || '');
  const archived = String(req.query.archived || '');
  const sortByRaw = String(req.query.sortBy || 'createdAt');
  const sortOrder = String(req.query.sortOrder || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
  const sortBy = ['createdAt', 'projectName', 'projectType', 'updatedAt'].includes(sortByRaw) ? sortByRaw : 'createdAt';

  try {
    const where = {
      deletedAt: null,
      ...(projectType ? { projectType: { equals: projectType, mode: 'insensitive' as const } } : {}),
      ...(archived === 'true' ? { archivedAt: { not: null } } : {}),
      ...(archived === 'false' ? { archivedAt: null } : {}),
      ...(search
        ? {
            OR: [
              { projectName: { contains: search, mode: 'insensitive' as const } },
              { clientName: { contains: search, mode: 'insensitive' as const } },
              { projectType: { contains: search, mode: 'insensitive' as const } },
              { projectLocation: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.projectFeasibilityStudy.findMany({
        where,
        ...(status ? {} : { skip, take: limit }),
        include: {
          costs: true,
          revenues: true,
        },
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.projectFeasibilityStudy.count({ where }),
    ]);

    const enriched = items.map((item) => withMetrics(item));
    if (status) {
      const filtered = enriched.filter((item) => item.calculations.overallStatus === status);
      const sliced = filtered.slice(skip, skip + limit);
      return res.json({ success: true, data: paginated(sliced, filtered.length, page, limit) });
    }
    res.json({ success: true, data: paginated(enriched, total, page, limit) });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to load feasibility studies');
  }
});

router.get('/:id', authenticate, authorize('feasibility:read'), async (req, res) => {
  const id = param(req.params.id);
  try {
    const study = await prisma.projectFeasibilityStudy.findFirst({
      where: { id, deletedAt: null },
      include: { costs: true, revenues: true },
    });
    if (!study) return res.status(404).json({ success: false, message: 'Not found', error: 'Not found' });
    res.json({ success: true, data: withMetrics(study) });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to load feasibility study');
  }
});

router.post('/', authenticate, authorize('feasibility:write'), async (req, res) => {
  const parsed = studySchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error.errors[0]?.message || 'Invalid feasibility data');
  try {
    const { costs, revenues, ...body } = parsed.data;
    const created = await prisma.projectFeasibilityStudy.create({
      data: {
        ...body,
        estimatedStartDate: body.estimatedStartDate ? new Date(body.estimatedStartDate) : null,
        estimatedCompletionDate: body.estimatedCompletionDate ? new Date(body.estimatedCompletionDate) : null,
        costs: { create: costs },
        revenues: { create: revenues },
      },
      include: { costs: true, revenues: true },
    });
    res.status(201).json({ success: true, data: withMetrics(created) });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to create feasibility study');
  }
});

router.put('/:id', authenticate, authorize('feasibility:write'), async (req, res) => {
  const id = param(req.params.id);
  const parsed = studySchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error.errors[0]?.message || 'Invalid feasibility data');
  try {
    const { costs, revenues, ...body } = parsed.data;
    const updated = await prisma.$transaction(async (tx) => {
      await tx.feasibilityCostItem.deleteMany({ where: { studyId: id } });
      await tx.feasibilityRevenueItem.deleteMany({ where: { studyId: id } });
      return tx.projectFeasibilityStudy.update({
        where: { id },
        data: {
          ...body,
          estimatedStartDate: body.estimatedStartDate ? new Date(body.estimatedStartDate) : null,
          estimatedCompletionDate: body.estimatedCompletionDate ? new Date(body.estimatedCompletionDate) : null,
          costs: { create: costs },
          revenues: { create: revenues },
        },
        include: { costs: true, revenues: true },
      });
    });
    res.json({ success: true, data: withMetrics(updated) });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to update feasibility study');
  }
});

router.delete('/:id', authenticate, authorize('feasibility:delete'), async (req, res) => {
  const id = param(req.params.id);
  try {
    await prisma.projectFeasibilityStudy.update({ where: { id }, data: { deletedAt: new Date() } });
    res.json({ success: true, data: null });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to delete feasibility study');
  }
});

router.post('/:id/duplicate', authenticate, authorize('feasibility:write'), async (req, res) => {
  const id = param(req.params.id);
  try {
    const source = await prisma.projectFeasibilityStudy.findFirst({
      where: { id, deletedAt: null },
      include: { costs: true, revenues: true },
    });
    if (!source) return res.status(404).json({ success: false, message: 'Not found', error: 'Not found' });

    const duplicated = await prisma.projectFeasibilityStudy.create({
      data: {
        projectName: `${source.projectName} (Copy)`,
        clientName: source.clientName,
        projectType: source.projectType,
        projectLocation: source.projectLocation,
        areaSqFt: source.areaSqFt,
        areaSqM: source.areaSqM,
        projectDurationMonths: source.projectDurationMonths,
        estimatedStartDate: source.estimatedStartDate,
        estimatedCompletionDate: source.estimatedCompletionDate,
        currency: source.currency,
        taxPercentage: source.taxPercentage,
        contingencyPercentage: source.contingencyPercentage,
        expectedProfitMargin: source.expectedProfitMargin,
        notes: source.notes,
        contractValue: source.contractValue,
        variationOrders: source.variationOrders,
        additionalIncome: source.additionalIncome,
        retentionRelease: source.retentionRelease,
        otherRevenue: source.otherRevenue,
        costs: { create: source.costs.map((c) => ({ category: c.category, subCategory: c.subCategory, amount: c.amount, isDirect: c.isDirect })) },
        revenues: { create: source.revenues.map((r) => ({ category: r.category, amount: r.amount })) },
      },
      include: { costs: true, revenues: true },
    });
    res.status(201).json({ success: true, data: withMetrics(duplicated) });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to duplicate feasibility study');
  }
});

router.post('/:id/archive', authenticate, authorize('feasibility:write'), async (req, res) => {
  const id = param(req.params.id);
  const archived = Boolean(req.body?.archived ?? true);
  try {
    const study = await prisma.projectFeasibilityStudy.update({
      where: { id },
      data: { archivedAt: archived ? new Date() : null },
      include: { costs: true, revenues: true },
    });
    res.json({ success: true, data: withMetrics(study) });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to archive feasibility study');
  }
});

router.get('/:id/report', authenticate, authorize('feasibility:read', 'feasibility:export'), async (req, res) => {
  const id = param(req.params.id);
  const format = String(req.query.format || 'json').toLowerCase();
  try {
    const study = await prisma.projectFeasibilityStudy.findFirst({
      where: { id, deletedAt: null },
      include: { costs: true, revenues: true },
    });
    if (!study) return res.status(404).json({ success: false, message: 'Not found', error: 'Not found' });
    const payload = withMetrics(study);

    if (format === 'csv') {
      const rows = [
        ['projectName', payload.projectName],
        ['projectType', payload.projectType],
        ['projectLocation', payload.projectLocation],
        ['totalEstimatedRevenue', payload.calculations.totalEstimatedRevenue],
        ['totalEstimatedCost', payload.calculations.totalEstimatedCost],
        ['netProfit', payload.calculations.netProfit],
        ['profitMargin', payload.calculations.profitMargin],
        ['roi', payload.calculations.roi],
        ['overallStatus', payload.calculations.overallStatus],
      ];
      const csv = `metric,value\n${rows.map((r) => `${r[0]},${JSON.stringify(r[1])}`).join('\n')}`;
      return res.json({ success: true, data: { format: 'csv', fileName: `feasibility-${id}.csv`, content: csv } });
    }

    return res.json({ success: true, data: { format: 'json', report: payload } });
  } catch (error) {
    sendPrismaError(res, error, 'Failed to generate feasibility report');
  }
});

export default router;
