import { getCurrentUser } from '@/lib/auth/session-manager';
import { redirect } from 'next/navigation';
import { ROUTES } from '@/lib/constants/auth';
import { DashboardHomeClient } from './dashboard-home-client';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect(ROUTES.login);

  return (
    <div>
      <p className="text-muted-foreground mb-4">Welcome, {user.displayName}!</p>
      <DashboardHomeClient />
    </div>
  );
}
