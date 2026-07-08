'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Building2,
  TrendingUp,
  Wallet,
  Users,
  Package,
  ShoppingBag,
  AlertTriangle,
  Bell,
  FolderKanban,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { StatCard, PageHeader, LoadingSpinner } from '@/components/ui/stat-card';
import { formatDate } from '@/lib/utils';

interface DashboardStats {
  stats: {
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    upcomingProjects: number;
    revenue: number;
    expenses: number;
    profit: number;
    cashFlow: number;
    bookings: number;
    flatsSold: number;
    flatsAvailable: number;
    outstandingPayments: number;
    employeeCount: number;
    lowStockAlerts: number;
  };
  chartData: { month: string; revenue: number; expenses: number; profit: number }[];
  projectProgress: { name: string; progress: number; status: string }[];
  notifications: {
    id: string;
    title: string;
    message: string;
    type: string;
    isRead: boolean;
    createdAt: string;
  }[];
}

export default function DashboardPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get<DashboardStats>('/dashboard/stats'),
  });

  if (isLoading) return <LoadingSpinner />;
  if (error || !data) {
    return (
      <div className="luxury-card p-8 text-center text-red-600">
        <p>{error instanceof Error ? error.message : 'Failed to load dashboard data'}</p>
        <button className="btn-outline mt-4" onClick={() => refetch()}>Retry</button>
      </div>
    );
  }

  const { stats, chartData, projectProgress, notifications } = data;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of RSS Construction ERP operations"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Revenue" value={formatCurrency(stats.revenue)} icon={TrendingUp} />
        <StatCard title="Total Expenses" value={formatCurrency(stats.expenses)} icon={Wallet} />
        <StatCard title="Net Profit" value={formatCurrency(stats.profit)} icon={Building2} trend={`${stats.activeProjects} active projects`} />
        <StatCard title="Active Projects" value={formatNumber(stats.activeProjects)} icon={FolderKanban} />
        <StatCard title="Confirmed Bookings" value={formatNumber(stats.bookings)} icon={ShoppingBag} />
        <StatCard title="Units Sold" value={formatNumber(stats.flatsSold)} icon={Building2} />
        <StatCard title="Units Available" value={formatNumber(stats.flatsAvailable)} icon={Package} />
        <StatCard title="Employees" value={formatNumber(stats.employeeCount)} icon={Users} />
        <StatCard title="Low Stock Alerts" value={formatNumber(stats.lowStockAlerts)} icon={AlertTriangle} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="luxury-card p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold text-luxury-charcoal mb-4">Revenue vs Expenses</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(43 74% 49%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(43 74% 49%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(40 20% 90%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Area type="monotone" dataKey="revenue" stroke="hsl(43 74% 49%)" fill="url(#goldGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="expenses" stroke="hsl(220 10% 40%)" fill="transparent" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="luxury-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5 text-gold" />
            <h3 className="text-lg font-semibold text-luxury-charcoal">Notifications</h3>
          </div>
          <div className="space-y-3 max-h-[280px] overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-sm text-luxury-slate text-center py-8">No notifications</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`rounded-lg p-3 text-sm ${n.isRead ? 'bg-luxury-cream' : 'bg-gold-50 border border-gold-100'}`}
                >
                  <p className="font-medium text-luxury-charcoal">{n.title}</p>
                  <p className="text-luxury-slate mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-xs text-luxury-slate/70 mt-1">{formatDate(n.createdAt)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="luxury-card p-6">
        <h3 className="text-lg font-semibold text-luxury-charcoal mb-4">Project Progress</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={projectProgress} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(40 20% 90%)" />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => `${v}%`} />
            <Bar dataKey="progress" fill="hsl(43 74% 49%)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
