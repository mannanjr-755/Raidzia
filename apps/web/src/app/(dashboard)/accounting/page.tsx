'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PageHeader, LoadingSpinner, EmptyState } from '@/components/ui/stat-card';

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  balance: number | string;
}

interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  description: string;
  lines: { account: { name: string }; debit: number | string; credit: number | string }[];
}

export default function AccountingPage() {
  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get<Account[]>('/accounts'),
  });

  const { data: journal, isLoading: journalLoading } = useQuery({
    queryKey: ['journal'],
    queryFn: () => api.get<JournalEntry[]>('/journal'),
  });

  return (
    <div>
      <PageHeader title="Accounting" description="Chart of accounts and journal entries" />

      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Chart of Accounts</h2>
        {accountsLoading ? (
          <LoadingSpinner />
        ) : !accounts?.length ? (
          <EmptyState message="No accounts found." />
        ) : (
          <div className="luxury-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-luxury-border bg-luxury-cream">
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Code</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Type</th>
                  <th className="px-4 py-3 text-right font-medium text-luxury-slate">Balance</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="border-b border-luxury-border">
                    <td className="px-4 py-3 font-mono text-gold">{a.code}</td>
                    <td className="px-4 py-3">{a.name}</td>
                    <td className="px-4 py-3 text-luxury-slate">{a.type}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(Number(a.balance))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Recent Journal Entries</h2>
        {journalLoading ? (
          <LoadingSpinner />
        ) : !journal?.length ? (
          <EmptyState message="No journal entries found." />
        ) : (
          <div className="space-y-3">
            {journal.slice(0, 10).map((entry) => (
              <div key={entry.id} className="luxury-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm text-gold">{entry.entryNumber}</span>
                  <span className="text-xs text-luxury-slate">{formatDate(entry.date)}</span>
                </div>
                <p className="text-sm text-luxury-charcoal">{entry.description}</p>
                <div className="mt-2 text-xs text-luxury-slate space-y-1">
                  {entry.lines.map((line, i) => (
                    <div key={i} className="flex justify-between">
                      <span>{line.account.name}</span>
                      <span>
                        {Number(line.debit) > 0 && `Dr ${formatCurrency(Number(line.debit))}`}
                        {Number(line.credit) > 0 && `Cr ${formatCurrency(Number(line.credit))}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
