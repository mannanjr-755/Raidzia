'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthUser, LoginCredentials } from '@/types/auth';
import { authService } from '@/services/auth.service';
import { ROUTES } from '@/lib/constants/auth';

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      setLoading(true);
      setError(null);
      const result = await authService.login(credentials);
      setLoading(false);

      if (!result.success) {
        setError(result.error ?? 'Login failed');
        return false;
      }

      setUser(result.user ?? null);
      router.push(ROUTES.dashboard);
      return true;
    },
    [router]
  );

  const logout = useCallback(async () => {
    setLoading(true);
    await authService.logout();
    setUser(null);
    setLoading(false);
    router.push(ROUTES.login);
    router.refresh();
  }, [router]);

  const refreshSession = useCallback(async () => {
    const sessionUser = await authService.getSession();
    setUser(sessionUser);
    return sessionUser;
  }, []);

  return { user, loading, error, login, logout, refreshSession };
}
