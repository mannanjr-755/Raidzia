import { NextRequest, NextResponse } from 'next/server';
import { loginSchema } from '@/lib/validation/schemas';
import { validateCredentials } from '@/lib/auth/credentials';
import { setSession } from '@/lib/auth/session-manager';
import { AUTH_ERRORS, AUTH_MESSAGES } from '@/lib/constants/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || AUTH_ERRORS.invalidCredentials },
        { status: 400 }
      );
    }

    const result = await validateCredentials(parsed.data);

    if (!result.success || !result.user) {
      return NextResponse.json(
        { success: false, error: result.error || AUTH_ERRORS.invalidCredentials },
        { status: 401 }
      );
    }

    await setSession(result.user, parsed.data.rememberMe ?? false);

    return NextResponse.json({
      success: true,
      message: AUTH_MESSAGES.loginSuccess,
      data: { user: result.user },
    });
  } catch {
    return NextResponse.json({ success: false, error: AUTH_ERRORS.generic }, { status: 500 });
  }
}
