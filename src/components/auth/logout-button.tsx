'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { ROUTES } from '@/lib/constants/auth';
import { Button } from '@/components/ui/button';

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await authService.logout();
    router.push(ROUTES.login);
    router.refresh();
  };

  return (
    <Button variant="outline" onClick={handleLogout} className="gap-2">
      <LogOut className="h-4 w-4" />
      Logout
    </Button>
  );
}
