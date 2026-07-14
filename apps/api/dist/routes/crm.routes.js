"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const pagination_1 = require("../lib/pagination");
const business_service_1 = require("../services/business.service");
const route_utils_1 = require("../lib/route-utils");
const router = (0, express_1.Router)();
const param = (value) => Array.isArray(value) ? value[0] : String(value || '');
const leadSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required'),
    phone: zod_1.z.string().min(1, 'Phone is required'),
    email: zod_1.z.string().email().optional().or(zod_1.z.literal('')).transform((v) => v || undefined),
    source: zod_1.z.string().optional(),
    status: zod_1.z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'NEGOTIATION', 'WON', 'LOST']).optional(),
    budget: zod_1.z.coerce.number().optional(),
    interest: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    customerId: zod_1.z.string().optional().nullable(),
    nextFollowUp: zod_1.z.string().optional().nullable(),
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
const bookingSchema = zod_1.z.object({
    customerId: zod_1.z.string().min(1, 'Customer is required'),
    unitId: zod_1.z.string().min(1, 'Unit is required'),
    totalAmount: zod_1.z.coerce.number().positive('Total amount is required'),
    downPayment: zod_1.z.coerce.number().min(0).optional(),
    discount: zod_1.z.coerce.number().min(0).optional(),
    status: zod_1.z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']).optional(),
    notes: zod_1.z.string().optional(),
    possessionDate: zod_1.z.string().optional().nullable(),
});
// ---------- Leads ----------
router.get('/leads', auth_1.authenticate, (0, auth_1.authorize)('crm:read'), async (req, res) => {
    const { page, limit, search, skip } = (0, pagination_1.getPagination)(req);
    const status = String(req.query.status || '');
    const where = {
        deletedAt: null,
        ...(status ? { status: status } : {}),
        ...(search
            ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { phone: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { interest: { contains: search, mode: 'insensitive' } },
                ],
            }
            : {}),
    };
    const [items, total] = await Promise.all([
        prisma_1.prisma.lead.findMany({
            where,
            skip,
            take: limit,
            include: {
                assignee: { select: { firstName: true, lastName: true } },
                customer: true,
            },
            orderBy: { createdAt: 'desc' },
        }),
        prisma_1.prisma.lead.count({ where }),
    ]);
    res.json({ success: true, data: (0, pagination_1.paginated)(items, total, page, limit) });
});
router.post('/leads', auth_1.authenticate, (0, auth_1.authorize)('crm:write'), async (req, res) => {
    const parsed = leadSchema.safeParse(req.body);
    if (!parsed.success)
        return (0, route_utils_1.validationError)(res, parsed.error.errors[0]?.message || 'Invalid lead data');
    try {
        const lead = await prisma_1.prisma.lead.create({
            data: {
                ...parsed.data,
                assigneeId: req.user.userId,
                nextFollowUp: parsed.data.nextFollowUp ? new Date(parsed.data.nextFollowUp) : undefined,
            },
            include: { assignee: { select: { firstName: true, lastName: true } } },
        });
        res.status(201).json({ success: true, data: lead });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to create lead');
    }
});
router.put('/leads/:id', auth_1.authenticate, (0, auth_1.authorize)('crm:write'), async (req, res) => {
    const id = param(req.params.id);
    const parsed = leadSchema.partial().safeParse(req.body);
    if (!parsed.success)
        return (0, route_utils_1.validationError)(res, parsed.error.errors[0]?.message || 'Invalid lead data');
    try {
        const lead = await prisma_1.prisma.lead.update({
            where: { id },
            data: {
                ...parsed.data,
                ...(parsed.data.nextFollowUp !== undefined
                    ? { nextFollowUp: parsed.data.nextFollowUp ? new Date(parsed.data.nextFollowUp) : null }
                    : {}),
            },
            include: { assignee: { select: { firstName: true, lastName: true } } },
        });
        res.json({ success: true, data: lead });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to update lead');
    }
});
router.delete('/leads/:id', auth_1.authenticate, (0, auth_1.authorize)('crm:write'), async (req, res) => {
    const id = param(req.params.id);
    try {
        await prisma_1.prisma.lead.update({ where: { id }, data: { deletedAt: new Date() } });
        res.json({ success: true, data: null });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to delete lead');
    }
});
// ---------- Customers ----------
router.get('/customers', auth_1.authenticate, (0, auth_1.authorize)('crm:read'), async (req, res) => {
    const { page, limit, search, skip } = (0, pagination_1.getPagination)(req);
    const where = {
        deletedAt: null,
        ...(search
            ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { phone: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { cnic: { contains: search, mode: 'insensitive' } },
                    { city: { contains: search, mode: 'insensitive' } },
                ],
            }
            : {}),
    };
    const [items, total] = await Promise.all([
        prisma_1.prisma.customer.findMany({
            where,
            skip,
            take: limit,
            orderBy: { name: 'asc' },
        }),
        prisma_1.prisma.customer.count({ where }),
    ]);
    res.json({ success: true, data: (0, pagination_1.paginated)(items, total, page, limit) });
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
router.put('/customers/:id', auth_1.authenticate, (0, auth_1.authorize)('crm:write'), async (req, res) => {
    const id = param(req.params.id);
    const parsed = customerSchema.partial().safeParse(req.body);
    if (!parsed.success)
        return (0, route_utils_1.validationError)(res, parsed.error.errors[0]?.message || 'Invalid customer data');
    try {
        const customer = await prisma_1.prisma.customer.update({ where: { id }, data: parsed.data });
        res.json({ success: true, data: customer });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to update customer');
    }
});
router.delete('/customers/:id', auth_1.authenticate, (0, auth_1.authorize)('crm:write'), async (req, res) => {
    const id = param(req.params.id);
    try {
        await prisma_1.prisma.customer.update({ where: { id }, data: { deletedAt: new Date() } });
        res.json({ success: true, data: null });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to delete customer');
    }
});
// ---------- Bookings ----------
router.get('/bookings', auth_1.authenticate, (0, auth_1.authorize)('sales:read'), async (req, res) => {
    const { page, limit, search, skip } = (0, pagination_1.getPagination)(req);
    const status = String(req.query.status || '');
    const where = {
        deletedAt: null,
        ...(status ? { status: status } : {}),
        ...(search
            ? {
                OR: [
                    { bookingNumber: { contains: search, mode: 'insensitive' } },
                    { notes: { contains: search, mode: 'insensitive' } },
                    { customer: { name: { contains: search, mode: 'insensitive' } } },
                    { customer: { phone: { contains: search, mode: 'insensitive' } } },
                ],
            }
            : {}),
    };
    const [items, total] = await Promise.all([
        prisma_1.prisma.booking.findMany({
            where,
            skip,
            take: limit,
            include: {
                customer: true,
                unit: { include: { floor: { include: { building: { include: { project: true } } } } } },
                installments: true,
            },
            orderBy: { createdAt: 'desc' },
        }),
        prisma_1.prisma.booking.count({ where }),
    ]);
    res.json({ success: true, data: (0, pagination_1.paginated)(items, total, page, limit) });
});
router.post('/bookings', auth_1.authenticate, (0, auth_1.authorize)('sales:write'), async (req, res) => {
    const parsed = bookingSchema.safeParse(req.body);
    if (!parsed.success)
        return (0, route_utils_1.validationError)(res, parsed.error.errors[0]?.message || 'Invalid booking data');
    try {
        const count = await prisma_1.prisma.booking.count();
        const booking = await prisma_1.prisma.booking.create({
            data: {
                bookingNumber: `BK-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
                customerId: parsed.data.customerId,
                unitId: parsed.data.unitId,
                salesAgentId: req.user.userId,
                totalAmount: parsed.data.totalAmount,
                downPayment: parsed.data.downPayment || 0,
                discount: parsed.data.discount || 0,
                status: parsed.data.status || 'PENDING',
                notes: parsed.data.notes,
                possessionDate: parsed.data.possessionDate ? new Date(parsed.data.possessionDate) : null,
            },
            include: { customer: true, unit: true },
        });
        await prisma_1.prisma.unit.update({ where: { id: parsed.data.unitId }, data: { status: 'RESERVED' } });
        res.status(201).json({ success: true, data: booking });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to create booking');
    }
});
router.put('/bookings/:id', auth_1.authenticate, (0, auth_1.authorize)('sales:write'), async (req, res) => {
    const id = param(req.params.id);
    const parsed = bookingSchema.partial().safeParse(req.body);
    if (!parsed.success)
        return (0, route_utils_1.validationError)(res, parsed.error.errors[0]?.message || 'Invalid booking data');
    try {
        const booking = await prisma_1.prisma.booking.update({
            where: { id },
            data: {
                ...parsed.data,
                ...(parsed.data.possessionDate !== undefined
                    ? { possessionDate: parsed.data.possessionDate ? new Date(parsed.data.possessionDate) : null }
                    : {}),
            },
            include: { customer: true, unit: true, installments: true },
        });
        res.json({ success: true, data: booking });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to update booking');
    }
});
router.delete('/bookings/:id', auth_1.authenticate, (0, auth_1.authorize)('sales:write'), async (req, res) => {
    const id = param(req.params.id);
    try {
        const booking = await prisma_1.prisma.booking.findUnique({ where: { id }, select: { unitId: true } });
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Not found', error: 'Not found' });
        }
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.booking.update({ where: { id }, data: { deletedAt: new Date(), status: 'CANCELLED' } }),
            prisma_1.prisma.unit.update({ where: { id: booking.unitId }, data: { status: 'AVAILABLE' } }),
        ]);
        res.json({ success: true, data: null });
    }
    catch (error) {
        (0, route_utils_1.sendPrismaError)(res, error, 'Failed to delete booking');
    }
});
router.post('/bookings/:id/confirm', auth_1.authenticate, (0, auth_1.authorize)('sales:write'), async (req, res) => {
    try {
        const booking = await (0, business_service_1.confirmBooking)(param(req.params.id), req.user.userId);
        res.json({ success: true, data: booking });
    }
    catch (e) {
        res.status(400).json({ success: false, message: e.message, error: e.message });
    }
});
exports.default = router;
