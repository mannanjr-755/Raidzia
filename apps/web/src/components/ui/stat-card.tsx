import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  className?: string;
}

export function StatCard({ title, value, icon: Icon, trend, className }: StatCardProps) {
  return (
    <div className={cn('stat-card', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-luxury-slate">{title}</p>
          <p className="mt-2 text-2xl font-bold text-luxury-charcoal">{value}</p>
          {trend && <p className="mt-1 text-xs text-gold-600">{trend}</p>}
        </div>
        <div className="rounded-lg bg-gold-50 p-2.5">
          <Icon className="h-5 w-5 text-gold" />
        </div>
      </div>
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="gold-accent-line mb-3" />
        <h1 className="text-2xl font-bold text-luxury-charcoal">{title}</h1>
        {description && <p className="mt-1 text-sm text-luxury-slate">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-12', className)}>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="luxury-card flex flex-col items-center justify-center py-16 text-center">
      <p className="text-luxury-slate">{message}</p>
    </div>
  );
}
