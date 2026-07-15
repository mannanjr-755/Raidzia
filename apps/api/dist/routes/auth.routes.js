"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
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
const strongPassword = zod_1.z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must include an uppercase letter')
    .regex(/[a-z]/, 'Password must include a lowercase letter')
    .regex(/[0-9]/, 'Password must include a number')
    .regex(/[^A-Za-z0-9]/, 'Password must include a special character');
const changePasswordSchema = zod_1.z
    .object({
    currentPassword: zod_1.z.string().min(1, 'Current password is required'),
    newPassword: strongPassword,
    confirmPassword: zod_1.z.string().min(1, 'Confirm your new password'),
})
    .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
})
    .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from your current password',
    path: ['newPassword'],
});
const authError = { success: false, message: 'Invalid email or password', error: 'Invalid email or password' };
const loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many login attempts. Please try again later.',
        error: 'Too many login attempts. Please try again later.',
    },
});
const changePasswordLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many password change attempts. Please try again later.',
        error: 'Too many password change attempts. Please try again later.',
    },
});
router.post('/login', loginLimiter, (0, route_utils_1.asyncHandler)(async (req, res) => {
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
        if (stored) {
            await prisma_1.prisma.refreshToken.delete({ where: { id: stored.id } }).catch(() => undefined);
        }
        return res.status(401).json({
            success: false,
            message: 'Invalid refresh token',
            error: 'Invalid refresh token',
        });
    }
    let payload;
    try {
        payload = (0, auth_1.verifyRefreshToken)(refreshToken);
    }
    catch {
        await prisma_1.prisma.refreshToken.delete({ where: { id: stored.id } }).catch(() => undefined);
        return res.status(401).json({
            success: false,
            message: 'Invalid refresh token',
            error: 'Invalid refresh token',
        });
    }
    const user = await prisma_1.prisma.user.findFirst({
        where: { id: payload.userId, isActive: true, deletedAt: null },
        select: { id: true, email: true, role: true },
    });
    if (!user) {
        await prisma_1.prisma.refreshToken.deleteMany({ where: { userId: stored.userId } });
        return res.status(401).json({
            success: false,
            message: 'Invalid refresh token',
            error: 'Invalid refresh token',
        });
    }
    const accessToken = (0, auth_1.signAccessToken)({
        userId: user.id,
        email: user.email,
        role: user.role,
    });
    return res.json({ success: true, data: { accessToken } });
}));
router.post('/logout', (0, route_utils_1.asyncHandler)(async (req, res) => {
    const { refreshToken } = req.body;
    // Prefer clearing by refresh token so logout works even when access token expired.
    if (refreshToken) {
        await prisma_1.prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
        return res.json({ success: true, message: 'Logged out successfully' });
    }
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
        try {
            const access = (0, auth_1.verifyAccessToken)(header.slice(7));
            await prisma_1.prisma.refreshToken.deleteMany({ where: { userId: access.userId } });
        }
        catch {
            // Already logged out / expired — still treat as success
        }
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
router.post('/change-password', auth_2.authenticate, changePasswordLimiter, (0, route_utils_1.asyncHandler)(async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
        const message = parsed.error.errors[0]?.message || 'Invalid password change request';
        return res.status(400).json({ success: false, message, error: message });
    }
    const user = await prisma_1.prisma.user.findFirst({
        where: {
            id: req.user.userId,
            isActive: true,
            deletedAt: null,
        },
    });
    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found', error: 'User not found' });
    }
    const currentOk = await bcryptjs_1.default.compare(parsed.data.currentPassword, user.passwordHash);
    if (!currentOk) {
        return res.status(401).json({
            success: false,
            message: 'Current password is incorrect',
            error: 'Current password is incorrect',
        });
    }
    // Extra guard against reuse (also covered by Zod refine)
    if (await bcryptjs_1.default.compare(parsed.data.newPassword, user.passwordHash)) {
        return res.status(400).json({
            success: false,
            message: 'New password must be different from your current password',
            error: 'New password must be different from your current password',
        });
    }
    const passwordHash = await bcryptjs_1.default.hash(parsed.data.newPassword, 12);
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.user.update({
            where: { id: user.id },
            data: { passwordHash },
        }),
        // Force re-login on all devices after password change
        prisma_1.prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
        prisma_1.prisma.activityLog.create({
            data: {
                userId: user.id,
                action: 'PASSWORD_CHANGED',
                entity: 'User',
                entityId: user.id,
                ipAddress: req.ip,
            },
        }),
    ]);
    return res.json({
        success: true,
        message: 'Your password has been changed successfully. Please sign in again.',
        data: { requireReauth: true },
    });
}));
exports.default = router;
