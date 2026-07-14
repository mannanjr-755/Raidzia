"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const pagination_1 = require("../lib/pagination");
const route_utils_1 = require("../lib/route-utils");
const router = (0, express_1.Router)();
const param = (value) => (Array.isArray(value) ? value[0] : String(value || ''));
const unitSchema = zod_1.z.object({
    floorId: zod_1.z.string().min(1),
    unitNumber: zod_1.z.string().min(1),
    unitType: zod_1.z.enum(['APARTMENT', 'SHOP', 'OFFICE', 'WAREHOUSE', 'PLOT', 'PENTHOUSE']).optional(),
    area: zod_1.z.coerce.number().positive(),
    price: zod_1.z.coerce.number().min(0),
    status: zod_1.z.enum(['AVAILABLE', 'RESERVED', 'BOOKED', 'SOLD', 'TRANSFERRED', 'UNDER_CONSTRUCTION']).optional(),
    bedrooms: zod_1.z.coerce.number().optional(),
    bathrooms: zod_1.z.coerce.number().optional(),
    description: zod_1.z.string().optional(),
});
const buildingSchema = zod_1.z.object({
    projectId: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1),
    tower: zod_1.z.string().optional(),
    totalFloors: zod_1.z.coerce.number().min(1).default(1),
});
router.get('/units', auth_1.authenticate, (0, auth_1.authorize)('properties:read'), async (req, res) => {
    const { page, limit, search, skip } = (0, pagination_1.getPagination)(req);
    const status = String(req.query.status || '');
    const projectId = String(req.query.projectId || '');
    const where = {
        deletedAt: null,
        ...(status ? { status: status } : {}),
        ...(projectId ? { floor: { building: { projectId } } } : {}),
        ...(search
            ? {
                OR: [
                    { unitNumber: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                ],
            }
            : {}),
    };
    const [items, total] = await Promise.all([
        prisma_1.prisma.unit.findMany({
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
        prisma_1.prisma.unit.count({ where }),
    ]);
    res.json({ success: true, data: (0, pagination_1.paginated)(items, total, page, limit) });
});
router.post('/units', auth_1.authenticate, (0, auth_1.authorize)('properties:write'), async (req, res) => {
    const parsed = unitSchema.safeParse(req.body);
    if (!parsed.success)
        return (0, route_utils_1.validationError)(res, parsed.error.errors[0]?.message || 'Invalid unit data');
    try {
        const unit = await prisma_1.prisma.unit.create({
            data: parsed.data,
            include: {
                floor: { include: { building: { include: { project: { select: { name: true, code: true } } } } } },
            },
        });
        res.status(201).json({ success: true, data: unit });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to create unit');
    }
});
router.put('/units/:id', auth_1.authenticate, (0, auth_1.authorize)('properties:write'), async (req, res) => {
    const id = param(req.params.id);
    const parsed = unitSchema.partial().safeParse(req.body);
    if (!parsed.success)
        return (0, route_utils_1.validationError)(res, parsed.error.errors[0]?.message || 'Invalid unit data');
    try {
        const unit = await prisma_1.prisma.unit.update({
            where: { id },
            data: parsed.data,
            include: {
                floor: { include: { building: { include: { project: { select: { name: true, code: true } } } } } },
            },
        });
        res.json({ success: true, data: unit });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to update unit');
    }
});
router.delete('/units/:id', auth_1.authenticate, (0, auth_1.authorize)('properties:delete'), async (req, res) => {
    const id = param(req.params.id);
    try {
        await prisma_1.prisma.unit.update({ where: { id }, data: { deletedAt: new Date() } });
        res.json({ success: true, data: null });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to delete unit');
    }
});
router.get('/buildings', auth_1.authenticate, (0, auth_1.authorize)('properties:read'), async (req, res) => {
    const { page, limit, search, skip } = (0, pagination_1.getPagination)(req);
    const projectId = String(req.query.projectId || '');
    const where = {
        ...(projectId ? { projectId } : {}),
        ...(search
            ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { tower: { contains: search, mode: 'insensitive' } },
                ],
            }
            : {}),
    };
    const [items, total] = await Promise.all([
        prisma_1.prisma.building.findMany({
            where,
            skip,
            take: limit,
            include: {
                project: { select: { id: true, name: true, code: true } },
                floors: { include: { _count: { select: { units: true } } }, orderBy: { number: 'asc' } },
            },
            orderBy: { createdAt: 'desc' },
        }),
        prisma_1.prisma.building.count({ where }),
    ]);
    res.json({ success: true, data: (0, pagination_1.paginated)(items, total, page, limit) });
});
router.post('/buildings', auth_1.authenticate, (0, auth_1.authorize)('properties:write'), async (req, res) => {
    const parsed = buildingSchema.safeParse(req.body);
    if (!parsed.success)
        return (0, route_utils_1.validationError)(res, parsed.error.errors[0]?.message || 'Invalid building data');
    try {
        const floors = Array.from({ length: parsed.data.totalFloors }, (_, i) => ({
            number: i + 1,
            name: `Floor ${i + 1}`,
        }));
        const building = await prisma_1.prisma.building.create({
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
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to create building');
    }
});
router.put('/buildings/:id', auth_1.authenticate, (0, auth_1.authorize)('properties:write'), async (req, res) => {
    const id = param(req.params.id);
    const parsed = buildingSchema.partial().safeParse(req.body);
    if (!parsed.success)
        return (0, route_utils_1.validationError)(res, parsed.error.errors[0]?.message || 'Invalid building data');
    try {
        const building = await prisma_1.prisma.building.update({
            where: { id },
            data: parsed.data,
            include: { project: { select: { name: true, code: true } }, floors: true },
        });
        res.json({ success: true, data: building });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to update building');
    }
});
router.delete('/buildings/:id', auth_1.authenticate, (0, auth_1.authorize)('properties:delete'), async (req, res) => {
    const id = param(req.params.id);
    try {
        await prisma_1.prisma.building.delete({ where: { id } });
        res.json({ success: true, data: null });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to delete building');
    }
});
router.get('/floors', auth_1.authenticate, (0, auth_1.authorize)('properties:read'), async (req, res) => {
    const buildingId = String(req.query.buildingId || '');
    const where = buildingId ? { buildingId } : {};
    const items = await prisma_1.prisma.floor.findMany({
        where,
        include: { building: { select: { name: true } }, _count: { select: { units: true } } },
        orderBy: { number: 'asc' },
    });
    res.json({ success: true, data: items });
});
exports.default = router;
