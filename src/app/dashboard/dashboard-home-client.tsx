'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, Users, Building2, Wallet, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch, formatCurrency, formatDate } from '@/lib/api/client';
import Link from 'next/link';
import { ROUTES } from '@/lib/constants/auth';

interface DashboardStats {
  stats: {
    revenue: number;
    expenses: number;
    profit: number;
    customerCount: number;
    vendorCount: number;
    accountCount: number;
    unreadNotifications: number;
    invoiceStats: { status: string; count: number }[];
  };
  chartData: { month: string; revenue: number; expenses: number; profit: number }[];
  accountBalances: { name: string; type: string; balance: number }[];
  recentInvoices: { id: string; invoiceNumber: string; total: number | string; status: string; customer: { name: string }; issueDate: string }[];
  recentExpenses: { id: string; description: string; amount: number | string; status: string; expenseDate: string }[];
}

function StatCard({ title, value, icon: Icon, trend }: { title: string; value: string; icon: React.ElementType; trend?: 'up' | 'down' }) {
  return (
    <Card className="glass">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          <div className={`p-3 rounded-xl ${trend === 'up' ? 'bg-emerald-500/10' : trend === 'down' ? 'bg-red-500/10' : 'bg-primary/10'}`}>
            <Icon className={`h-5 w-5 ${trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-600' : 'text-primary'}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardHomeClient() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<DashboardStats>('/api/dashboard/stats').then((res) => {
      if (res.success && res.data) setData(res.data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (!data) return <p className="text-muted-foreground">Failed to load dashboard data.</p>;

  const { stats, chartData, accountBalances, recentInvoices, recentExpenses } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Accounting Dashboard</h1>
        <p className="text-muted-foreground text-sm">Real-time financial overview</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Revenue" value={formatCurrency(stats.revenue)} icon={DollarSign} trend="up" />
        <StatCard title="Total Expenses" value={formatCurrency(stats.expenses)} icon={TrendingDown} trend="down" />
        <StatCard title="Net Profit" value={formatCurrency(stats.profit)} icon={TrendingUp} trend={stats.profit >= 0 ? 'up' : 'down'} />
        <StatCard title="Customers" value={String(stats.customerCount)} icon={Users} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <StatCard title="Vendors" value={String(stats.vendorCount)} icon={Building2} />
        <StatCard title="Accounts" value={String(stats.accountCount)} icon={Wallet} />
        <StatCard title="Unread Alerts" value={String(stats.unreadNotifications)} icon={FileText} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Revenue vs Expenses</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Monthly Profit Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Line type="monotone" dataKey="profit" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Account Balances</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {accountBalances.map((a) => (
              <div key={a.name} className="flex justify-between items-center p-3 rounded-lg border">
                <div>
                  <p className="font-medium text-sm">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.type}</p>
                </div>
                <p className="font-semibold">{formatCurrency(a.balance)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Invoices</CardTitle>
            <Link href={ROUTES.invoices} className="text-sm text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentInvoices.map((inv) => (
              <div key={inv.id} className="flex justify-between items-center py-2 border-b last:border-0">
                <div>
                  <p className="font-medium text-sm">{inv.invoiceNumber}</p>
                  <p className="text-xs text-muted-foreground">{inv.customer.name} · {formatDate(inv.issueDate)}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">{formatCurrency(Number(inv.total))}</p>
                  <Badge variant={inv.status === 'PAID' ? 'success' : inv.status === 'OVERDUE' ? 'destructive' : 'secondary'}>{inv.status}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Expenses</CardTitle>
            <Link href={ROUTES.expenses} className="text-sm text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentExpenses.map((exp) => (
              <div key={exp.id} className="flex justify-between items-center py-2 border-b last:border-0">
                <div>
                  <p className="font-medium text-sm">{exp.description}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(exp.expenseDate)}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">{formatCurrency(Number(exp.amount))}</p>
                  <Badge variant={exp.status === 'PAID' ? 'success' : exp.status === 'PENDING' ? 'warning' : 'secondary'}>{exp.status}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
