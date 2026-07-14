"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const pagination_1 = require("../lib/pagination");
const feasibility_service_1 = require("../services/feasibility.service");
const route_utils_1 = require("../lib/route-utils");
const router = (0, express_1.Router)();
const param = (value) => Array.isArray(value) ? value[0] : String(value || '');
const landSchema = zod_1.z.object({
    landId: zod_1.z.string().optional(),
    title: zod_1.z.string().min(1),
    location: zod_1.z.string().min(1),
    latitude: zod_1.z.coerce.number().optional(),
    longitude: zod_1.z.coerce.number().optional(),
    areaSqYards: zod_1.z.coerce.number().positive(),
    areaSqFeet: zod_1.z.coerce.number().positive(),
    landType: zod_1.z.enum(['RESIDENTIAL', 'COMMERCIAL', 'MIXED_USE', 'INDUSTRIAL', 'AGRICULTURAL']).optional(),
    status: zod_1.z.enum(['RESEARCH', 'NEGOTIATION', 'DUE_DILIGENCE', 'APPROVED', 'PURCHASED', 'REJECTED']).optional(),
    purchasePrice: zod_1.z.coerce.number().optional(),
    marketPrice: zod_1.z.coerce.number().optional(),
    roadWidth: zod_1.z.coerce.number().optional(),
    isCornerPlot: zod_1.z.boolean().optional(),
    hasElectricity: zod_1.z.boolean().optional(),
    hasGas: zod_1.z.boolean().optional(),
    hasWater: zod_1.z.boolean().optional(),
    legalStatus: zod_1.z.string().optional(),
    ownerName: zod_1.z.string().optional(),
    ownerPhone: zod_1.z.string().optional(),
    brokerName: zod_1.z.string().optional(),
    brokerPhone: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
router.get('/', auth_1.authenticate, (0, auth_1.authorize)('land:read'), async (req, res) => {
    const { page, limit, search, skip } = (0, pagination_1.getPagination)(req);
    const status = String(req.query.status || '');
    const landType = String(req.query.landType || '');
    const where = {
        deletedAt: null,
        ...(status ? { status: status } : {}),
        ...(landType ? { landType: landType } : {}),
        ...(search
            ? {
                OR: [
                    { title: { contains: search, mode: 'insensitive' } },
                    { landId: { contains: search, mode: 'insensitive' } },
                    { location: { contains: search, mode: 'insensitive' } },
                ],
            }
            : {}),
    };
    const [items, total] = await Promise.all([
        prisma_1.prisma.landParcel.findMany({
            where,
            skip,
            take: limit,
            include: { negotiations: { orderBy: { createdAt: 'desc' }, take: 1 } },
            orderBy: { createdAt: 'desc' },
        }),
        prisma_1.prisma.landParcel.count({ where }),
    ]);
    res.json({ success: true, data: (0, pagination_1.paginated)(items, total, page, limit) });
});
router.get('/next-id', auth_1.authenticate, (0, auth_1.authorize)('land:write'), async (_req, res) => {
    try {
        const landId = await (0, route_utils_1.generateLandId)();
        res.json({ success: true, data: { landId } });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to generate land ID');
    }
});
router.get('/:id', auth_1.authenticate, (0, auth_1.authorize)('land:read'), async (req, res) => {
    const id = param(req.params.id);
    const land = await prisma_1.prisma.landParcel.findFirst({
        where: { id, deletedAt: null },
        include: { negotiations: true, documents: true, projects: true },
    });
    if (!land)
        return res.status(404).json({ success: false, message: 'Not found', error: 'Not found' });
    res.json({ success: true, data: land });
});
router.post('/', auth_1.authenticate, (0, auth_1.authorize)('land:write'), async (req, res) => {
    const parsed = landSchema.safeParse(req.body);
    if (!parsed.success)
        return (0, route_utils_1.validationError)(res, parsed.error.errors[0]?.message || 'Invalid land data');
    const landId = parsed.data.landId?.trim() ? (0, route_utils_1.normalizeCode)(parsed.data.landId) : await (0, route_utils_1.generateLandId)();
    const unique = await (0, route_utils_1.ensureUniqueCode)(res, () => prisma_1.prisma.landParcel.findUnique({ where: { landId }, select: { id: true, deletedAt: true } }));
    if (!unique)
        return;
    try {
        const land = await prisma_1.prisma.landParcel.create({ data: { ...parsed.data, landId } });
        res.status(201).json({ success: true, data: land });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to create land parcel');
    }
});
router.put('/:id', auth_1.authenticate, (0, auth_1.authorize)('land:write'), async (req, res) => {
    const id = param(req.params.id);
    const parsed = landSchema.partial().safeParse(req.body);
    if (!parsed.success)
        return (0, route_utils_1.validationError)(res, parsed.error.errors[0]?.message || 'Invalid land data');
    const landId = parsed.data.landId ? (0, route_utils_1.normalizeCode)(parsed.data.landId) : undefined;
    if (landId) {
        const unique = await (0, route_utils_1.ensureUniqueCode)(res, () => prisma_1.prisma.landParcel.findUnique({ where: { landId }, select: { id: true, deletedAt: true } }), id);
        if (!unique)
            return;
    }
    try {
        const land = await prisma_1.prisma.landParcel.update({ where: { id }, data: { ...parsed.data, ...(landId ? { landId } : {}) } });
        res.json({ success: true, data: land });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to update land parcel');
    }
});
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorize)('land:delete'), async (req, res) => {
    const id = param(req.params.id);
    try {
        const existing = await prisma_1.prisma.landParcel.findUnique({ where: { id }, select: { landId: true } });
        if (!existing)
            return res.status(404).json({ success: false, message: 'Not found', error: 'Not found' });
        await prisma_1.prisma.landParcel.update({
            where: { id },
            data: { deletedAt: new Date(), landId: (0, route_utils_1.releaseCodeValue)(existing.landId) },
        });
        res.json({ success: true, data: null });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to delete land parcel');
    }
});
router.post('/:id/feasibility', auth_1.authenticate, (0, auth_1.authorize)('land:feasibility'), async (req, res) => {
    const id = param(req.params.id);
    try {
        const land = await prisma_1.prisma.landParcel.findUnique({ where: { id } });
        if (!land)
            return res.status(404).json({ success: false, message: 'Land not found', error: 'Land not found' });
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
        const result = (0, feasibility_service_1.calculateFeasibility)(input);
        const study = await prisma_1.prisma.feasibilityStudy.create({
            data: (0, feasibility_service_1.mapFeasibilityToDb)(input, result, id, req.body.title || `Feasibility - ${land.title}`, req.body.buildingType || 'RESIDENTIAL'),
        });
        res.status(201).json({ success: true, data: { ...study, calculations: result } });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to run feasibility study');
    }
});
exports.default = router;
