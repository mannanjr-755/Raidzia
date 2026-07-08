"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const route_utils_1 = require("../lib/route-utils");
const router = (0, express_1.Router)();
const param = (value) => (Array.isArray(value) ? value[0] : String(value || ''));
const projectSchema = zod_1.z.object({
    code: zod_1.z.string().optional(),
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    location: zod_1.z.string().min(1),
    city: zod_1.z.string().optional(),
    clientName: zod_1.z.string().optional(),
    status: zod_1.z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
    budget: zod_1.z.coerce.number().default(0),
    estimatedCost: zod_1.z.coerce.number().default(0),
    completionPct: zod_1.z.coerce.number().min(0).max(100).default(0),
    startDate: zod_1.z.string().optional(),
    endDate: zod_1.z.string().optional(),
    managerId: zod_1.z.string().optional().nullable(),
    landParcelId: zod_1.z.string().optional().nullable(),
});
router.get('/', auth_1.authenticate, (0, auth_1.authorize)('projects:read'), async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page || 1)));
    const limit = Math.min(100, parseInt(String(req.query.limit || 10)));
    const search = String(req.query.search || '');
    const status = req.query.status;
    const where = {
        deletedAt: null,
        ...(status ? { status: status } : {}),
        ...(search
            ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { code: { contains: search, mode: 'insensitive' } },
                ],
            }
            : {}),
    };
    const [items, total] = await Promise.all([
        prisma_1.prisma.project.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            include: { manager: { select: { firstName: true, lastName: true } }, landParcel: { select: { title: true } } },
            orderBy: { createdAt: 'desc' },
        }),
        prisma_1.prisma.project.count({ where }),
    ]);
    res.json({ success: true, data: { items, total, page, limit, totalPages: Math.ceil(total / limit) } });
});
router.get('/next-code', auth_1.authenticate, (0, auth_1.authorize)('projects:write'), async (_req, res) => {
    try {
        const code = await (0, route_utils_1.generateProjectCode)();
        res.json({ success: true, data: { code } });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to generate project code');
    }
});
router.get('/:id', auth_1.authenticate, (0, auth_1.authorize)('projects:read'), async (req, res) => {
    const id = param(req.params.id);
    const project = await prisma_1.prisma.project.findFirst({
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
    if (!project)
        return res.status(404).json({ success: false, message: 'Not found', error: 'Not found' });
    res.json({ success: true, data: project });
});
router.post('/', auth_1.authenticate, (0, auth_1.authorize)('projects:write'), async (req, res) => {
    const parsed = projectSchema.safeParse(req.body);
    if (!parsed.success)
        return (0, route_utils_1.validationError)(res, parsed.error.errors[0]?.message || 'Invalid project data');
    const code = parsed.data.code?.trim()
        ? (0, route_utils_1.normalizeCode)(parsed.data.code)
        : await (0, route_utils_1.generateProjectCode)();
    const unique = await (0, route_utils_1.ensureUniqueCode)(res, () => prisma_1.prisma.project.findUnique({ where: { code }, select: { id: true, deletedAt: true } }));
    if (!unique)
        return;
    const data = {
        ...parsed.data,
        code,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
    };
    try {
        const project = await prisma_1.prisma.project.create({ data });
        await prisma_1.prisma.activityLog.create({
            data: { userId: req.user.userId, action: 'CREATE', entity: 'Project', entityId: project.id },
        });
        res.status(201).json({ success: true, data: project });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to create project');
    }
});
router.put('/:id', auth_1.authenticate, (0, auth_1.authorize)('projects:write'), async (req, res) => {
    const id = param(req.params.id);
    const parsed = projectSchema.safeParse(req.body);
    if (!parsed.success)
        return (0, route_utils_1.validationError)(res, parsed.error.errors[0]?.message || 'Invalid project data');
    const code = parsed.data.code?.trim()
        ? (0, route_utils_1.normalizeCode)(parsed.data.code)
        : await (0, route_utils_1.generateProjectCode)();
    const unique = await (0, route_utils_1.ensureUniqueCode)(res, () => prisma_1.prisma.project.findUnique({ where: { code }, select: { id: true, deletedAt: true } }), id);
    if (!unique)
        return;
    const data = {
        ...parsed.data,
        code,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
    };
    try {
        const project = await prisma_1.prisma.project.update({ where: { id }, data });
        res.json({ success: true, data: project });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to update project');
    }
});
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorize)('projects:delete'), async (req, res) => {
    const id = param(req.params.id);
    try {
        const project = await prisma_1.prisma.project.findUnique({ where: { id }, select: { code: true } });
        if (!project)
            return res.status(404).json({ success: false, message: 'Not found', error: 'Not found' });
        await prisma_1.prisma.project.update({
            where: { id },
            data: { deletedAt: new Date(), code: (0, route_utils_1.releaseCodeValue)(project.code) },
        });
        res.json({ success: true, data: null });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to delete project');
    }
});
router.post('/:id/milestones', auth_1.authenticate, (0, auth_1.authorize)('projects:write'), async (req, res) => {
    const id = param(req.params.id);
    try {
        const milestone = await prisma_1.prisma.projectMilestone.create({
            data: {
                projectId: id,
                title: req.body.title,
                description: req.body.description,
                dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
            },
        });
        res.status(201).json({ success: true, data: milestone });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to create milestone');
    }
});
router.post('/:id/progress', auth_1.authenticate, (0, auth_1.authorize)('projects:write'), async (req, res) => {
    const id = param(req.params.id);
    try {
        const log = await prisma_1.prisma.dailyProgress.create({
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
            await prisma_1.prisma.project.update({
                where: { id },
                data: { completionPct: req.body.completionPct, actualCost: { increment: req.body.costAdded || 0 } },
            });
        }
        res.status(201).json({ success: true, data: log });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to save progress');
    }
});
exports.default = router;
