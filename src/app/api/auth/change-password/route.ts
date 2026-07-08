import { NextRequest, NextResponse } from 'next/server';
import { changePasswordSchema } from '@/lib/validation/schemas';
import { validateCurrentPassword, changeUserPassword } from '@/lib/auth/credentials';
import { getSession } from '@/lib/auth/session-manager';
import { AUTH_ERRORS, AUTH_MESSAGES } from '@/lib/constants/auth';
import { createAuditLog } from '@/lib/api/helpers';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: AUTH_ERRORS.unauthorized }, { status: 401 });
    }

    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = parsed.data;

    const valid = await validateCurrentPassword(session.user.id, currentPassword);
    if (!valid) {
      return NextResponse.json({ success: false, error: 'Current password is incorrect' }, { status: 401 });
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { success: false, error: 'New password must be different from current password' },
        { status: 400 }
      );
    }

    await changeUserPassword(session.user.id, newPassword);
    await createAuditLog(session.user.id, 'UPDATE', 'User', session.user.id, { action: 'password_change' });

    return NextResponse.json({ success: true, message: AUTH_MESSAGES.passwordChanged });
  } catch {
    return NextResponse.json({ success: false, error: AUTH_ERRORS.generic }, { status: 500 });
  }
}
