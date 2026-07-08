import { NextRequest, NextResponse } from 'next/server';
import { forgotPasswordSchema } from '@/lib/validation/schemas';
import { getUserByEmail } from '@/lib/auth/credentials';
import { AUTH_ERRORS, AUTH_MESSAGES } from '@/lib/constants/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message },
        { status: 400 }
      );
    }

    const user = await getUserByEmail(parsed.data.email);
    // Always return success to prevent email enumeration
    if (user && process.env.NODE_ENV === 'development') {
      console.log(`[Auth] Password reset simulated for: ${parsed.data.email}`);
    }

    await new Promise((r) => setTimeout(r, 600));

    return NextResponse.json({ success: true, message: AUTH_MESSAGES.resetEmailSent });
  } catch {
    return NextResponse.json({ success: false, error: AUTH_ERRORS.generic }, { status: 500 });
  }
}
