"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const route_utils_1 = require("../lib/route-utils");
const router = (0, express_1.Router)();
const param = (value) => (Array.isArray(value) ? value[0] : String(value || ''));
const employeeSchema = zod_1.z.object({
    employeeCode: zod_1.z.string().optional(),
    firstName: zod_1.z.string().min(1, 'First name is required'),
    lastName: zod_1.z.string().min(1, 'Last name is required'),
    email: zod_1.z.string().email().optional().or(zod_1.z.literal('')).transform((v) => v || undefined),
    phone: zod_1.z.string().min(1, 'Phone is required'),
    department: zod_1.z.string().optional(),
    designation: zod_1.z.string().optional(),
    salary: zod_1.z.coerce.number().min(0).default(0),
    joinDate: zod_1.z.string().optional(),
});
router.get('/', auth_1.authenticate, (0, auth_1.authorize)('hr:read'), async (_req, res) => {
    const items = await prisma_1.prisma.employee.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: items });
});
router.post('/', auth_1.authenticate, (0, auth_1.authorize)('hr:write'), async (req, res) => {
    const parsed = employeeSchema.safeParse(req.body);
    if (!parsed.success)
        return (0, route_utils_1.validationError)(res, parsed.error.errors[0]?.message || 'Invalid employee data');
    const employeeCode = parsed.data.employeeCode?.trim()
        ? (0, route_utils_1.normalizeCode)(parsed.data.employeeCode)
        : await (0, route_utils_1.generateEmployeeCode)();
    const unique = await (0, route_utils_1.ensureUniqueCode)(res, () => prisma_1.prisma.employee.findUnique({ where: { employeeCode }, select: { id: true, deletedAt: true } }));
    if (!unique)
        return;
    try {
        const employee = await prisma_1.prisma.employee.create({
            data: {
                ...parsed.data,
                employeeCode,
                joinDate: parsed.data.joinDate ? new Date(parsed.data.joinDate) : new Date(),
            },
        });
        res.status(201).json({ success: true, data: employee });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to create employee');
    }
});
router.put('/:id', auth_1.authenticate, (0, auth_1.authorize)('hr:write'), async (req, res) => {
    const id = param(req.params.id);
    const parsed = employeeSchema.partial().safeParse(req.body);
    if (!parsed.success)
        return (0, route_utils_1.validationError)(res, parsed.error.errors[0]?.message || 'Invalid employee data');
    const employeeCode = parsed.data.employeeCode?.trim()
        ? (0, route_utils_1.normalizeCode)(parsed.data.employeeCode)
        : undefined;
    if (employeeCode) {
        const unique = await (0, route_utils_1.ensureUniqueCode)(res, () => prisma_1.prisma.employee.findUnique({ where: { employeeCode }, select: { id: true, deletedAt: true } }), id);
        if (!unique)
            return;
    }
    try {
        const employee = await prisma_1.prisma.employee.update({
            where: { id },
            data: {
                ...parsed.data,
                ...(employeeCode ? { employeeCode } : {}),
                ...(parsed.data.joinDate ? { joinDate: new Date(parsed.data.joinDate) } : {}),
            },
        });
        res.json({ success: true, data: employee });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to update employee');
    }
});
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorize)('hr:write'), async (req, res) => {
    const id = param(req.params.id);
    try {
        const employee = await prisma_1.prisma.employee.findUnique({ where: { id }, select: { employeeCode: true } });
        if (!employee)
            return res.status(404).json({ success: false, message: 'Not found', error: 'Not found' });
        await prisma_1.prisma.employee.update({
            where: { id },
            data: { deletedAt: new Date(), isActive: false, employeeCode: (0, route_utils_1.releaseCodeValue)(employee.employeeCode) },
        });
        res.json({ success: true, data: null });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to delete employee');
    }
});
exports.default = router;
