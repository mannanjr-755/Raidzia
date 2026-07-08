"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const route_utils_1 = require("../lib/route-utils");
const router = (0, express_1.Router)();
const param = (value) => (Array.isArray(value) ? value[0] : String(value || ''));
const inspectionSchema = zod_1.z.object({
    projectId: zod_1.z.string().min(1, 'Project is required'),
    title: zod_1.z.string().min(1, 'Title is required'),
    type: zod_1.z.string().default('QUALITY'),
    status: zod_1.z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']).optional(),
    date: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
router.get('/', auth_1.authenticate, (0, auth_1.authorize)('inspection:read'), async (_req, res) => {
    const items = await prisma_1.prisma.inspection.findMany({
        include: { project: { select: { name: true, code: true } }, inspector: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
    });
    res.json({ success: true, data: items });
});
router.post('/', auth_1.authenticate, (0, auth_1.authorize)('inspection:write'), async (req, res) => {
    const parsed = inspectionSchema.safeParse(req.body);
    if (!parsed.success)
        return (0, route_utils_1.validationError)(res, parsed.error.errors[0]?.message || 'Invalid inspection data');
    try {
        const inspection = await prisma_1.prisma.inspection.create({
            data: {
                ...parsed.data,
                inspectorId: req.user.userId,
                date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
            },
            include: { project: { select: { name: true, code: true } } },
        });
        res.status(201).json({ success: true, data: inspection });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to create inspection');
    }
});
router.put('/:id', auth_1.authenticate, (0, auth_1.authorize)('inspection:write'), async (req, res) => {
    const id = param(req.params.id);
    const parsed = inspectionSchema.partial().safeParse(req.body);
    if (!parsed.success)
        return (0, route_utils_1.validationError)(res, parsed.error.errors[0]?.message || 'Invalid inspection data');
    try {
        const inspection = await prisma_1.prisma.inspection.update({
            where: { id },
            data: {
                ...parsed.data,
                ...(parsed.data.date ? { date: new Date(parsed.data.date) } : {}),
            },
            include: { project: { select: { name: true, code: true } } },
        });
        res.json({ success: true, data: inspection });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to update inspection');
    }
});
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorize)('inspection:write'), async (req, res) => {
    const id = param(req.params.id);
    try {
        await prisma_1.prisma.inspection.delete({ where: { id } });
        res.json({ success: true, data: null });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to delete inspection');
    }
});
exports.default = router;
