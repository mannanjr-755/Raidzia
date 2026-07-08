import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/auth';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../lib/route-utils';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const authError = { success: false, message: 'Invalid email or password', error: 'Invalid email or password' };

router.post(
  '/login',
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
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
        error: 'Invalid refresh token',
      });
    }

    const payload = verifyRefreshToken(refreshToken);
    const accessToken = signAccessToken(payload);

    return res.json({ success: true, data: { accessToken } });
  })
);

router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
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

export default router;
