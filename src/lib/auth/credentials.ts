import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import type { AuthUser, LoginCredentials, LoginResult } from '@/types/auth';
import { AUTH_ERRORS } from '@/lib/constants/auth';

export async function validateCredentials(credentials: LoginCredentials): Promise<LoginResult> {
  const username = credentials.username.trim();

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username }, { email: username }],
      isActive: true,
      deletedAt: null,
    },
  });

  if (!user) {
    return { success: false, error: AUTH_ERRORS.invalidCredentials };
  }

  const valid = await bcrypt.compare(credentials.password, user.passwordHash);
  if (!valid) {
    return { success: false, error: AUTH_ERRORS.invalidCredentials };
  }

  const authUser: AuthUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: `${user.firstName} ${user.lastName}`,
    role: user.role,
  };

  return { success: true, user: authUser };
}

export async function validateCurrentPassword(userId: string, currentPassword: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;
  return bcrypt.compare(currentPassword, user.passwordHash);
}

export async function changeUserPassword(userId: string, newPassword: string): Promise<void> {
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
}

export async function getUserByEmail(email: string) {
  return prisma.user.findFirst({
    where: { email, isActive: true, deletedAt: null },
  });
}
