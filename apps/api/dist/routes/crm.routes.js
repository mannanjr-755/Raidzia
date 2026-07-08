"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const business_service_1 = require("../services/business.service");
const route_utils_1 = require("../lib/route-utils");
const router = (0, express_1.Router)();
const leadSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required'),
    phone: zod_1.z.string().min(1, 'Phone is required'),
    email: zod_1.z.string().email().optional().or(zod_1.z.literal('')).transform((v) => v || undefined),
    source: zod_1.z.string().optional(),
    status: zod_1.z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'NEGOTIATION', 'WON', 'LOST']).optional(),
    budget: zod_1.z.coerce.number().optional(),
    interest: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
const customerSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required'),
    phone: zod_1.z.string().min(1, 'Phone is required'),
    email: zod_1.z.string().email().optional().or(zod_1.z.literal('')).transform((v) => v || undefined),
    cnic: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    source: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
router.get('/bookings', auth_1.authenticate, (0, auth_1.authorize)('sales:read'), async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page || 1)));
    const limit = Math.min(100, parseInt(String(req.query.limit || 10)));
    const [items, total] = await Promise.all([
        prisma_1.prisma.booking.findMany({
            where: { deletedAt: null },
            include: { customer: true, unit: { include: { floor: { include: { building: { include: { project: true } } } } } }, installments: true },
            skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        }),
        prisma_1.prisma.booking.count({ where: { deletedAt: null } }),
    ]);
    res.json({ success: true, data: { items, total, page, limit, totalPages: Math.ceil(total / limit) } });
});
router.post('/bookings', auth_1.authenticate, (0, auth_1.authorize)('sales:write'), async (req, res) => {
    try {
        const count = await prisma_1.prisma.booking.count();
        const booking = await prisma_1.prisma.booking.create({
            data: {
                bookingNumber: `BK-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
                customerId: req.body.customerId,
                unitId: req.body.unitId,
                salesAgentId: req.user.userId,
                totalAmount: req.body.totalAmount,
                downPayment: req.body.downPayment || 0,
                discount: req.body.discount || 0,
                status: 'PENDING',
                notes: req.body.notes,
            },
            include: { customer: true, unit: true },
        });
        await prisma_1.prisma.unit.update({ where: { id: req.body.unitId }, data: { status: 'RESERVED' } });
        res.status(201).json({ success: true, data: booking });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to create booking');
    }
});
router.post('/bookings/:id/confirm', auth_1.authenticate, (0, auth_1.authorize)('sales:write'), async (req, res) => {
    try {
        const booking = await (0, business_service_1.confirmBooking)(req.params.id, req.user.userId);
        res.json({ success: true, data: booking });
    }
    catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
});
router.get('/leads', auth_1.authenticate, (0, auth_1.authorize)('crm:read'), async (_req, res) => {
    const items = await prisma_1.prisma.lead.findMany({
        where: { deletedAt: null },
        include: { assignee: { select: { firstName: true, lastName: true } }, customer: true },
        orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: items });
});
router.post('/leads', auth_1.authenticate, (0, auth_1.authorize)('crm:write'), async (req, res) => {
    const parsed = leadSchema.safeParse(req.body);
    if (!parsed.success)
        return (0, route_utils_1.validationError)(res, parsed.error.errors[0]?.message || 'Invalid lead data');
    try {
        const lead = await prisma_1.prisma.lead.create({
            data: { ...parsed.data, assigneeId: req.user.userId },
            include: { assignee: { select: { firstName: true, lastName: true } } },
        });
        res.status(201).json({ success: true, data: lead });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to create lead');
    }
});
router.put('/leads/:id', auth_1.authenticate, (0, auth_1.authorize)('crm:write'), async (req, res) => {
    const parsed = leadSchema.partial().safeParse(req.body);
    if (!parsed.success)
        return (0, route_utils_1.validationError)(res, parsed.error.errors[0]?.message || 'Invalid lead data');
    try {
        const lead = await prisma_1.prisma.lead.update({
            where: { id: req.params.id },
            data: parsed.data,
            include: { assignee: { select: { firstName: true, lastName: true } } },
        });
        res.json({ success: true, data: lead });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to update lead');
    }
});
router.get('/customers', auth_1.authenticate, (0, auth_1.authorize)('crm:read'), async (_req, res) => {
    const items = await prisma_1.prisma.customer.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } });
    res.json({ success: true, data: items });
});
router.post('/customers', auth_1.authenticate, (0, auth_1.authorize)('crm:write'), async (req, res) => {
    const parsed = customerSchema.safeParse(req.body);
    if (!parsed.success)
        return (0, route_utils_1.validationError)(res, parsed.error.errors[0]?.message || 'Invalid customer data');
    try {
        const customer = await prisma_1.prisma.customer.create({ data: parsed.data });
        res.status(201).json({ success: true, data: customer });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to create customer');
    }
});
exports.default = router;
