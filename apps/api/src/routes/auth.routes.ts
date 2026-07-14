import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from '../lib/auth';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../lib/route-utils';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const strongPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[0-9]/, 'Password must include a number')
  .regex(/[^A-Za-z0-9]/, 'Password must include a special character');

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: strongPassword,
    confirmPassword: z.string().min(1, 'Confirm your new password'),
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

const loginLimiter = rateLimit({
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

const changePasswordLimiter = rateLimit({
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

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(authError);
    }

    const user = await prisma.user.findFirst({
      where: {
        email: parsed.data.email,
        isActive: true,
        deletedAt: null,
      },
    });

    if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
      return res.status(401).json(authError);
    }

    const payload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await prisma.activityLog.create({
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
  })
);

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Token required', error: 'Token required' });
    }

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.expiresAt < new Date()) {
      if (stored) {
        await prisma.refreshToken.delete({ where: { id: stored.id } }).catch(() => undefined);
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
        error: 'Invalid refresh token',
      });
    }

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      await prisma.refreshToken.delete({ where: { id: stored.id } }).catch(() => undefined);
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
        error: 'Invalid refresh token',
      });
    }

    const user = await prisma.user.findFirst({
      where: { id: payload.userId, isActive: true, deletedAt: null },
      select: { id: true, email: true, role: true },
    });
    if (!user) {
      await prisma.refreshToken.deleteMany({ where: { userId: stored.userId } });
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
        error: 'Invalid refresh token',
      });
    }

    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return res.json({ success: true, data: { accessToken } });
  })
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body as { refreshToken?: string };

    // Prefer clearing by refresh token so logout works even when access token expired.
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
      return res.json({ success: true, message: 'Logged out successfully' });
    }

    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      try {
        const access = verifyAccessToken(header.slice(7));
        await prisma.refreshToken.deleteMany({ where: { userId: access.userId } });
      } catch {
        // Already logged out / expired — still treat as success
      }
    }

    return res.json({ success: true, message: 'Logged out successfully' });
  })
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
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
  })
);

router.post(
  '/change-password',
  authenticate,
  changePasswordLimiter,
  asyncHandler(async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.errors[0]?.message || 'Invalid password change request';
      return res.status(400).json({ success: false, message, error: message });
    }

    const user = await prisma.user.findFirst({
      where: {
        id: req.user!.userId,
        isActive: true,
        deletedAt: null,
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', error: 'User not found' });
    }

    const currentOk = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!currentOk) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
        error: 'Current password is incorrect',
      });
    }

    // Extra guard against reuse (also covered by Zod refine)
    if (await bcrypt.compare(parsed.data.newPassword, user.passwordHash)) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from your current password',
        error: 'New password must be different from your current password',
      });
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      // Force re-login on all devices after password change
      prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
      prisma.activityLog.create({
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
  })
);

export default router;
