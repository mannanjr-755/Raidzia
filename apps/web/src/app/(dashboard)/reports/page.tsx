'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { PageHeader, LoadingSpinner } from '@/components/ui/stat-card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface DashboardStats {
  stats: {
    revenue: number;
    expenses: number;
    profit: number;
    totalProjects: number;
    bookings: number;
    flatsSold: number;
  };
  chartData: { month: string; revenue: number; expenses: number; profit: number }[];
}

const COLORS = ['hsl(43 74% 49%)', 'hsl(220 10% 40%)', 'hsl(142 50% 45%)'];

export default function ReportsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['reports-dashboard'],
    queryFn: () => api.get<DashboardStats>('/dashboard/stats'),
  });

  const pieData = data
    ? [
        { name: 'Revenue', value: data.stats.revenue },
        { name: 'Expenses', value: data.stats.expenses },
        { name: 'Profit', value: Math.max(0, data.stats.profit) },
      ]
    : [];

  return (
    <div>
      <PageHeader title="Reports" description="Financial and operational reports" />
      {isLoading ? (
        <LoadingSpinner />
      ) : data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Revenue', value: formatCurrency(data.stats.revenue) },
              { label: 'Expenses', value: formatCurrency(data.stats.expenses) },
              { label: 'Profit', value: formatCurrency(data.stats.profit) },
              { label: 'Bookings', value: data.stats.bookings },
            ].map((s) => (
              <div key={s.label} className="stat-card">
                <p className="text-sm text-luxury-slate">{s.label}</p>
                <p className="text-xl font-bold mt-1">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="luxury-card p-6">
              <h3 className="font-semibold mb-4">Monthly Profit</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.chartData}>
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
        </div>
      ) : null}
    </div>
  );
}
