import { cookies } from 'next/headers';
import type { SessionData, AuthUser } from '@/types/auth';
import {
  SESSION_COOKIE,
  decodeSession,
  encodeSession,
  buildSession,
  getSessionMaxAge,
} from '@/lib/auth/session';

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return decodeSession(token);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getSession();
  return session?.user ?? null;
}

export async function setSession(user: AuthUser, rememberMe: boolean): Promise<void> {
  const session = buildSession(user, rememberMe);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: getSessionMaxAge(rememberMe),
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session !== null;
}
