"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const pagination_1 = require("../lib/pagination");
const route_utils_1 = require("../lib/route-utils");
const feasibility_service_1 = require("../services/feasibility.service");
const auth_2 = require("../lib/auth");
const router = (0, express_1.Router)();
const param = (value) => (Array.isArray(value) ? value[0] : String(value || ''));
const costItemSchema = zod_1.z.object({
    category: zod_1.z.string().min(1),
    subCategory: zod_1.z.string().optional().nullable(),
    amount: zod_1.z.coerce.number().min(0),
    isDirect: zod_1.z.boolean().optional().default(true),
});
const revenueItemSchema = zod_1.z.object({
    category: zod_1.z.string().min(1),
    amount: zod_1.z.coerce.number().min(0),
});
const studySchema = zod_1.z.object({
    projectName: zod_1.z.string().min(1),
    clientName: zod_1.z.string().optional().nullable(),
    projectType: zod_1.z.string().min(1),
    projectLocation: zod_1.z.string().min(1),
    areaSqFt: zod_1.z.coerce.number().min(0).default(0),
    areaSqM: zod_1.z.coerce.number().min(0).default(0),
    projectDurationMonths: zod_1.z.coerce.number().int().min(0).default(0),
    estimatedStartDate: zod_1.z.string().optional().nullable(),
    estimatedCompletionDate: zod_1.z.string().optional().nullable(),
    currency: zod_1.z.string().min(1).default('PKR'),
    taxPercentage: zod_1.z.coerce.number().min(0).default(0),
    contingencyPercentage: zod_1.z.coerce.number().min(0).default(0),
    expectedProfitMargin: zod_1.z.coerce.number().min(0).default(0),
    notes: zod_1.z.string().optional().nullable(),
    contractValue: zod_1.z.coerce.number().min(0).default(0),
    variationOrders: zod_1.z.coerce.number().min(0).default(0),
    additionalIncome: zod_1.z.coerce.number().min(0).default(0),
    retentionRelease: zod_1.z.coerce.number().min(0).default(0),
    otherRevenue: zod_1.z.coerce.number().min(0).default(0),
    costs: zod_1.z.array(costItemSchema).default([]),
    revenues: zod_1.z.array(revenueItemSchema).default([]),
});
function withMetrics(study) {
    const metrics = (0, feasibility_service_1.calculateProjectFeasibility)({
        areaSqFt: (0, auth_2.toNum)(study.areaSqFt),
        areaSqM: (0, auth_2.toNum)(study.areaSqM),
        projectDurationMonths: study.projectDurationMonths,
        taxPercentage: (0, auth_2.toNum)(study.taxPercentage),
        contingencyPercentage: (0, auth_2.toNum)(study.contingencyPercentage),
        expectedProfitMargin: (0, auth_2.toNum)(study.expectedProfitMargin),
        contractValue: (0, auth_2.toNum)(study.contractValue),
        variationOrders: (0, auth_2.toNum)(study.variationOrders),
        additionalIncome: (0, auth_2.toNum)(study.additionalIncome),
        retentionRelease: (0, auth_2.toNum)(study.retentionRelease),
        otherRevenue: (0, auth_2.toNum)(study.otherRevenue),
        archivedAt: study.archivedAt,
        costs: study.costs.map((item) => ({ amount: (0, auth_2.toNum)(item.amount), isDirect: item.isDirect })),
        revenues: study.revenues.map((item) => ({ amount: (0, auth_2.toNum)(item.amount) })),
    });
    return { ...study, calculations: metrics };
}
router.get('/', auth_1.authenticate, (0, auth_1.authorize)('feasibility:read'), async (req, res) => {
    const { page, limit, search, skip } = (0, pagination_1.getPagination)(req);
    const status = String(req.query.status || '');
    const projectType = String(req.query.projectType || '');
    const archived = String(req.query.archived || '');
    const sortByRaw = String(req.query.sortBy || 'createdAt');
    const sortOrder = String(req.query.sortOrder || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
    const sortBy = ['createdAt', 'projectName', 'projectType', 'updatedAt'].includes(sortByRaw) ? sortByRaw : 'createdAt';
    try {
        const where = {
            deletedAt: null,
            ...(projectType ? { projectType: { equals: projectType, mode: 'insensitive' } } : {}),
            ...(archived === 'true' ? { archivedAt: { not: null } } : {}),
            ...(archived === 'false' ? { archivedAt: null } : {}),
            ...(search
                ? {
                    OR: [
                        { projectName: { contains: search, mode: 'insensitive' } },
                        { clientName: { contains: search, mode: 'insensitive' } },
                        { projectType: { contains: search, mode: 'insensitive' } },
                        { projectLocation: { contains: search, mode: 'insensitive' } },
                    ],
                }
                : {}),
        };
        const [items, total] = await Promise.all([
            prisma_1.prisma.projectFeasibilityStudy.findMany({
                where,
                ...(status ? {} : { skip, take: limit }),
                include: {
                    costs: true,
                    revenues: true,
                },
                orderBy: { [sortBy]: sortOrder },
            }),
            prisma_1.prisma.projectFeasibilityStudy.count({ where }),
        ]);
        const enriched = items.map((item) => withMetrics(item));
        if (status) {
            const filtered = enriched.filter((item) => item.calculations.overallStatus === status);
            const sliced = filtered.slice(skip, skip + limit);
            return res.json({ success: true, data: (0, pagination_1.paginated)(sliced, filtered.length, page, limit) });
        }
        res.json({ success: true, data: (0, pagination_1.paginated)(enriched, total, page, limit) });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to load feasibility studies');
    }
});
router.get('/:id', auth_1.authenticate, (0, auth_1.authorize)('feasibility:read'), async (req, res) => {
    const id = param(req.params.id);
    try {
        const study = await prisma_1.prisma.projectFeasibilityStudy.findFirst({
            where: { id, deletedAt: null },
            include: { costs: true, revenues: true },
        });
        if (!study)
            return res.status(404).json({ success: false, message: 'Not found', error: 'Not found' });
        res.json({ success: true, data: withMetrics(study) });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to load feasibility study');
    }
});
router.post('/', auth_1.authenticate, (0, auth_1.authorize)('feasibility:write'), async (req, res) => {
    const parsed = studySchema.safeParse(req.body);
    if (!parsed.success)
        return (0, route_utils_1.validationError)(res, parsed.error.errors[0]?.message || 'Invalid feasibility data');
    try {
        const { costs, revenues, ...body } = parsed.data;
        const created = await prisma_1.prisma.projectFeasibilityStudy.create({
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
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to create feasibility study');
    }
});
router.put('/:id', auth_1.authenticate, (0, auth_1.authorize)('feasibility:write'), async (req, res) => {
    const id = param(req.params.id);
    const parsed = studySchema.safeParse(req.body);
    if (!parsed.success)
        return (0, route_utils_1.validationError)(res, parsed.error.errors[0]?.message || 'Invalid feasibility data');
    try {
        const { costs, revenues, ...body } = parsed.data;
        const updated = await prisma_1.prisma.$transaction(async (tx) => {
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
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to update feasibility study');
    }
});
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorize)('feasibility:delete'), async (req, res) => {
    const id = param(req.params.id);
    try {
        await prisma_1.prisma.projectFeasibilityStudy.update({ where: { id }, data: { deletedAt: new Date() } });
        res.json({ success: true, data: null });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to delete feasibility study');
    }
});
router.post('/:id/duplicate', auth_1.authenticate, (0, auth_1.authorize)('feasibility:write'), async (req, res) => {
    const id = param(req.params.id);
    try {
        const source = await prisma_1.prisma.projectFeasibilityStudy.findFirst({
            where: { id, deletedAt: null },
            include: { costs: true, revenues: true },
        });
        if (!source)
            return res.status(404).json({ success: false, message: 'Not found', error: 'Not found' });
        const duplicated = await prisma_1.prisma.projectFeasibilityStudy.create({
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
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to duplicate feasibility study');
    }
});
router.post('/:id/archive', auth_1.authenticate, (0, auth_1.authorize)('feasibility:write'), async (req, res) => {
    const id = param(req.params.id);
    const archived = Boolean(req.body?.archived ?? true);
    try {
        const study = await prisma_1.prisma.projectFeasibilityStudy.update({
            where: { id },
            data: { archivedAt: archived ? new Date() : null },
            include: { costs: true, revenues: true },
        });
        res.json({ success: true, data: withMetrics(study) });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to archive feasibility study');
    }
});
router.get('/:id/report', auth_1.authenticate, (0, auth_1.authorize)('feasibility:read', 'feasibility:export'), async (req, res) => {
    const id = param(req.params.id);
    const format = String(req.query.format || 'json').toLowerCase();
    try {
        const study = await prisma_1.prisma.projectFeasibilityStudy.findFirst({
            where: { id, deletedAt: null },
            include: { costs: true, revenues: true },
        });
        if (!study)
            return res.status(404).json({ success: false, message: 'Not found', error: 'Not found' });
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
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to generate feasibility report');
    }
});
exports.default = router;
