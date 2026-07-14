'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { PageHeader, LoadingSpinner } from '@/components/ui/stat-card';

interface ReportSummary {
  stats: {
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    upcomingProjects: number;
    revenue: number;
    expenses: number;
    profit: number;
    cashFlow: number;
    constructionCost: number;
    materialCost: number;
    labourCost: number;
    equipmentCost: number;
    bookings: number;
    flatsSold: number;
    flatsAvailable: number;
    outstandingPayments: number;
    employeeCount: number;
    lowStockAlerts: number;
    totalLeads: number;
    totalCustomers: number;
    totalLand: number;
  };
  chartData: { month: string; revenue: number; expenses: number; profit: number }[];
}

const COLORS = ['hsl(43 74% 49%)', 'hsl(220 10% 40%)', 'hsl(142 50% 45%)'];

const EXPORT_TYPES = [
  { type: 'projects', label: 'Projects' },
  { type: 'expenses', label: 'Expenses' },
  { type: 'bookings', label: 'Bookings' },
  { type: 'inventory', label: 'Inventory' },
] as const;

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [exporting, setExporting] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['reports-summary'],
    queryFn: () => api.get<ReportSummary>('/reports/summary'),
  });

  const handleExport = async (type: (typeof EXPORT_TYPES)[number]['type']) => {
    setExporting(type);
    try {
      const payload = await api.get<{ type: string; rows: unknown[] }>(`/reports/export?type=${type}`);
      downloadJson(`rss-${type}-export.json`, payload);
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} export downloaded`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  if (error || !data) {
    return (
      <div>
        <PageHeader title="Reports" description="Financial and operational reports" />
        <div className="luxury-card p-8 text-center text-red-600">
          <p>{error instanceof Error ? error.message : 'Failed to load report summary'}</p>
          <button className="btn-outline mt-4" onClick={() => refetch()}>Retry</button>
        </div>
      </div>
    );
  }

  const { stats, chartData } = data;

  const pieData = [
    { name: 'Revenue', value: stats.revenue },
    { name: 'Expenses', value: stats.expenses },
    { name: 'Profit', value: Math.max(0, stats.profit) },
  ];

  const costBreakdown = [
    { name: 'Construction', value: stats.constructionCost },
    { name: 'Material', value: stats.materialCost },
    { name: 'Labour', value: stats.labourCost },
    { name: 'Equipment', value: stats.equipmentCost },
  ];

  return (
    <div>
      <PageHeader title="Reports" description="Financial and operational reports with JSON export" />

      <div className="mb-6 flex flex-wrap gap-3">
        {EXPORT_TYPES.map((item) => (
          <button
            key={item.type}
            type="button"
            className="btn-outline"
            disabled={exporting === item.type}
            onClick={() => handleExport(item.type)}
          >
            <Download className="h-4 w-4" />
            {exporting === item.type ? `Exporting ${item.label}...` : `Export ${item.label}`}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Revenue', value: formatCurrency(stats.revenue) },
            { label: 'Expenses', value: formatCurrency(stats.expenses) },
            { label: 'Profit', value: formatCurrency(stats.profit) },
            { label: 'Cash Flow', value: formatCurrency(stats.cashFlow) },
            { label: 'Projects', value: formatNumber(stats.totalProjects) },
            { label: 'Bookings', value: formatNumber(stats.bookings) },
            { label: 'Units Sold', value: formatNumber(stats.flatsSold) },
            { label: 'Employees', value: formatNumber(stats.employeeCount) },
          ].map((s) => (
            <div key={s.label} className="stat-card">
              <p className="text-sm text-luxury-slate">{s.label}</p>
              <p className="text-xl font-bold mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Active Projects', value: stats.activeProjects },
            { label: 'Completed', value: stats.completedProjects },
            { label: 'Units Available', value: stats.flatsAvailable },
            { label: 'Low Stock Alerts', value: stats.lowStockAlerts },
            { label: 'Outstanding Payments', value: stats.outstandingPayments },
            { label: 'Leads', value: stats.totalLeads },
            { label: 'Customers', value: stats.totalCustomers },
            { label: 'Land Parcels', value: stats.totalLand },
          ].map((s) => (
            <div key={s.label} className="luxury-card p-4">
              <p className="text-xs text-luxury-slate">{s.label}</p>
              <p className="text-lg font-semibold mt-1">{formatNumber(s.value)}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="luxury-card p-6">
            <h3 className="font-semibold mb-4">Monthly Profit</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(40 20% 90%)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="profit" fill="hsl(43 74% 49%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="luxury-card p-6">
            <h3 className="font-semibold mb-4">Financial Breakdown</h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="luxury-card p-6">
          <h3 className="font-semibold mb-4">Expense Category Totals</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {costBreakdown.map((item) => (
              <div key={item.name} className="rounded-lg border border-luxury-border bg-luxury-cream/40 p-4">
                <p className="text-xs text-luxury-slate">{item.name}</p>
                <p className="text-lg font-semibold mt-1">{formatCurrency(item.value)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
