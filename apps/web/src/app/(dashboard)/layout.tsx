'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { cn } from '@/lib/utils';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  // Keep icon rail on narrow viewports so content stays usable without redesign.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => {
      if (mq.matches) setCollapsed(true);
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return (
    <div className="min-h-screen">
      <Sidebar collapsed={collapsed} onCollapsedChange={setCollapsed} />
      <main
        className={cn(
          'transition-all duration-300',
          collapsed ? 'pl-[72px]' : 'pl-[260px]'
        )}
      >
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
