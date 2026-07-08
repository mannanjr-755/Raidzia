'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Wallet,
  Users,
  Building2,
  FileText,
  Receipt,
  ArrowLeftRight,
  BarChart3,
  Bell,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { NAV_ITEMS, APP_NAME, ROUTES } from '@/lib/constants/auth';
import { AuthLogo } from '@/components/auth/auth-logo';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { LogoutButton } from '@/components/auth/logout-button';
import type { AuthUser } from '@/types';

const ICONS = {
  LayoutDashboard,
  Wallet,
  Users,
  Building2,
  FileText,
  Receipt,
  ArrowLeftRight,
  BarChart3,
  Bell,
};

export function DashboardShell({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-background">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 border-r bg-card/95 backdrop-blur-sm transform transition-transform lg:translate-x-0 lg:static',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full p-4">
          <div className="mb-6 px-2">
            <AuthLogo size="sm" />
          </div>
          <nav className="flex-1 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = ICONS[item.icon as keyof typeof ICONS];
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t pt-4 px-2">
            <p className="text-sm font-medium truncate">{user.displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{user.role.replace('_', ' ')}</p>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-card/80 backdrop-blur-sm px-4 h-16">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 rounded-lg hover:bg-muted" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <span className="font-semibold hidden sm:block">{APP_NAME}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href={ROUTES.notifications} className="p-2 rounded-lg hover:bg-muted relative">
              <Bell className="h-5 w-5" />
            </Link>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
