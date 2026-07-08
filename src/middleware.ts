import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, ROUTES } from '@/lib/constants/auth';

const protectedPrefixes = ['/dashboard'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(SESSION_COOKIE);
  const hasSession = Boolean(sessionCookie?.value);

  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p));

  if (isProtected && !hasSession) {
    const loginUrl = new URL(ROUTES.login, request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && pathname === ROUTES.login) {
    return NextResponse.redirect(new URL(ROUTES.dashboard, request.url));
  }

  const response = NextResponse.next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/forgot-password', '/change-password'],
};
