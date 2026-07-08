"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../lib/auth");
const auth_2 = require("../middleware/auth");
const route_utils_1 = require("../lib/route-utils");
const router = (0, express_1.Router)();
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
});
const authError = { success: false, message: 'Invalid email or password', error: 'Invalid email or password' };
router.post('/login', (0, route_utils_1.asyncHandler)(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json(authError);
    }
    const user = await prisma_1.prisma.user.findFirst({
        where: {
            email: parsed.data.email,
            isActive: true,
            deletedAt: null,
        },
    });
    if (!user || !(await bcryptjs_1.default.compare(parsed.data.password, user.passwordHash))) {
        return res.status(401).json(authError);
    }
    const payload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = (0, auth_1.signAccessToken)(payload);
    const refreshToken = (0, auth_1.signRefreshToken)(payload);
    await prisma_1.prisma.refreshToken.create({
        data: {
            token: refreshToken,
            userId: user.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
    });
    await prisma_1.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
    });
    await prisma_1.prisma.activityLog.create({
        data: {
            userId: user.id,
            action: 'LOGIN',
            entity: 'User',
            entityId: user.id,
            ipAddress: req.ip,
        },
    });
    return res.json({
        success: true,
        message: 'Logged in successfully',
        data: {
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                avatar: user.avatar,
                twoFactorEnabled: user.twoFactorEnabled,
            },
            accessToken,
            refreshToken,
        },
    });
}));
router.post('/refresh', (0, route_utils_1.asyncHandler)(async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        return res.status(400).json({ success: false, message: 'Token required', error: 'Token required' });
    }
    const stored = await prisma_1.prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.expiresAt < new Date()) {
        return res.status(401).json({
            success: false,
            message: 'Invalid refresh token',
            error: 'Invalid refresh token',
        });
    }
    const payload = (0, auth_1.verifyRefreshToken)(refreshToken);
    const accessToken = (0, auth_1.signAccessToken)(payload);
    return res.json({ success: true, data: { accessToken } });
}));
router.post('/logout', auth_2.authenticate, (0, route_utils_1.asyncHandler)(async (req, res) => {
    const { refreshToken } = req.body;
    if (refreshToken) {
        await prisma_1.prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }
    return res.json({ success: true, message: 'Logged out successfully' });
}));
router.get('/me', auth_2.authenticate, (0, route_utils_1.asyncHandler)(async (req, res) => {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: req.user.userId },
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            avatar: true,
            twoFactorEnabled: true,
            isActive: true,
        },
    });
    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found', error: 'User not found' });
    }
    return res.json({ success: true, data: user });
}));
exports.default = router;
