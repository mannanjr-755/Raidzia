'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Download, FileText, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiFetch, formatCurrency } from '@/lib/api/client';

const REPORT_TYPES = [
  { value: 'summary', label: 'Financial Summary' },
  { value: 'invoices', label: 'Invoices Report' },
  { value: 'expenses', label: 'Expenses Report' },
  { value: 'all', label: 'Full Report' },
] as const;

type ReportType = typeof REPORT_TYPES[number]['value'];

interface SummaryReport {
  totalRevenue?: number;
  totalExpenses?: number;
  profit?: number;
  invoiceCount?: number;
  customerCount?: number;
  invoices?: { number: string; customer: string; status: string; total: number; issueDate: string }[];
  expenses?: { description: string; category: string; vendor: string; amount: number; status: string; date: string }[];
}

export function ReportsPageClient() {
  const [reportType, setReportType] = useState<ReportType>('summary');
  const [reportData, setReportData] = useState<SummaryReport | null>(null);
  const [loading, setLoading] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch<SummaryReport>(`/api/reports?type=${reportType}&format=json`);
    if (res.success && res.data) {
      setReportData(res.data);
    } else {
      toast.error(res.error || 'Failed to load report');
      setReportData(null);
    }
    setLoading(false);
  }, [reportType]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const handleExport = (format: 'excel' | 'pdf') => {
    window.open(`/api/reports?type=${reportType}&format=${format}`, '_blank');
    toast.success(`Exporting ${reportType} report as ${format.toUpperCase()}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground text-sm">Generate and export financial reports</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadReport} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button variant="outline" onClick={() => handleExport('excel')}><Download className="h-4 w-4" /> Excel</Button>
          <Button variant="outline" onClick={() => handleExport('pdf')}><Download className="h-4 w-4" /> PDF</Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <select
          className="h-11 rounded-lg border border-input bg-background px-3 text-sm sm:max-w-xs"
          value={reportType}
          onChange={(e) => setReportType(e.target.value as ReportType)}
        >
          {REPORT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="rounded-xl border p-12 text-center">
          <p className="text-muted-foreground">Generating report...</p>
        </div>
      ) : !reportData ? (
        <div className="rounded-xl border p-12 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No report data available</p>
        </div>
      ) : (
        <div className="space-y-6">
          {(reportType === 'summary' || reportType === 'all') && reportData.totalRevenue !== undefined && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl border p-4">
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(reportData.totalRevenue)}</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-sm text-muted-foreground">Total Expenses</p>
                <p className="text-2xl font-bold">{formatCurrency(reportData.totalExpenses ?? 0)}</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-sm text-muted-foreground">Net Profit</p>
                <p className={`text-2xl font-bold ${(reportData.profit ?? 0) >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                  {formatCurrency(reportData.profit ?? 0)}
                </p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-sm text-muted-foreground">Invoices / Customers</p>
                <p className="text-2xl font-bold">{reportData.invoiceCount ?? 0} / {reportData.customerCount ?? 0}</p>
              </div>
            </div>
          )}

          {(reportType === 'invoices' || reportType === 'all') && reportData.invoices && reportData.invoices.length > 0 && (
            <div className="rounded-xl border overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/50">
                <h2 className="font-medium">Invoices</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Number</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Customer</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Total</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.invoices.map((inv, idx) => (
                      <tr key={idx} className="border-b last:border-0">
                        <td className="px-4 py-3">{inv.number}</td>
                        <td className="px-4 py-3">{inv.customer}</td>
                        <td className="px-4 py-3"><Badge variant="secondary">{inv.status}</Badge></td>
                        <td className="px-4 py-3">{formatCurrency(inv.total)}</td>
                        <td className="px-4 py-3">{inv.issueDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(reportType === 'expenses' || reportType === 'all') && reportData.expenses && reportData.expenses.length > 0 && (
            <div className="rounded-xl border overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/50">
                <h2 className="font-medium">Expenses</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Description</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Vendor</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Amount</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.expenses.map((exp, idx) => (
                      <tr key={idx} className="border-b last:border-0">
                        <td className="px-4 py-3">{exp.description}</td>
                        <td className="px-4 py-3">{exp.category}</td>
                        <td className="px-4 py-3">{exp.vendor}</td>
                        <td className="px-4 py-3">{formatCurrency(exp.amount)}</td>
                        <td className="px-4 py-3"><Badge variant="secondary">{exp.status}</Badge></td>
                        <td className="px-4 py-3">{exp.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
