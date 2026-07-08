"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const route_utils_1 = require("../lib/route-utils");
const router = (0, express_1.Router)();
const param = (value) => (Array.isArray(value) ? value[0] : String(value || ''));
const machinerySchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required'),
    type: zod_1.z.string().min(1, 'Type is required'),
    registrationNo: zod_1.z.string().optional(),
    status: zod_1.z.enum(['OPERATIONAL', 'MAINTENANCE', 'REPAIR', 'IDLE', 'RETIRED']).optional(),
    purchaseDate: zod_1.z.string().optional(),
    purchaseCost: zod_1.z.coerce.number().optional(),
    operatorName: zod_1.z.string().optional(),
    fuelCapacity: zod_1.z.coerce.number().optional(),
});
router.get('/', auth_1.authenticate, (0, auth_1.authorize)('machinery:read'), async (_req, res) => {
    const items = await prisma_1.prisma.machinery.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: items });
});
router.post('/', auth_1.authenticate, (0, auth_1.authorize)('machinery:write'), async (req, res) => {
    const parsed = machinerySchema.safeParse(req.body);
    if (!parsed.success)
        return (0, route_utils_1.validationError)(res, parsed.error.errors[0]?.message || 'Invalid machinery data');
    try {
        const machinery = await prisma_1.prisma.machinery.create({
            data: {
                ...parsed.data,
                purchaseDate: parsed.data.purchaseDate ? new Date(parsed.data.purchaseDate) : null,
            },
        });
        res.status(201).json({ success: true, data: machinery });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to create machinery');
    }
});
router.put('/:id', auth_1.authenticate, (0, auth_1.authorize)('machinery:write'), async (req, res) => {
    const id = param(req.params.id);
    const parsed = machinerySchema.partial().safeParse(req.body);
    if (!parsed.success)
        return (0, route_utils_1.validationError)(res, parsed.error.errors[0]?.message || 'Invalid machinery data');
    try {
        const machinery = await prisma_1.prisma.machinery.update({
            where: { id },
            data: {
                ...parsed.data,
                ...(parsed.data.purchaseDate ? { purchaseDate: new Date(parsed.data.purchaseDate) } : {}),
            },
        });
        res.json({ success: true, data: machinery });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to update machinery');
    }
});
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorize)('machinery:write'), async (req, res) => {
    const id = param(req.params.id);
    try {
        await prisma_1.prisma.machinery.update({ where: { id }, data: { deletedAt: new Date() } });
        res.json({ success: true, data: null });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to delete machinery');
    }
});
exports.default = router;
