import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session-manager';
import { ROUTES } from '@/lib/constants/auth';
import { DashboardShell } from '@/components/layout/dashboard-shell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect(ROUTES.login);

  return <DashboardShell user={user}>{children}</DashboardShell>;
}
