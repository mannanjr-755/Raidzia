'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Search, Download, Pencil, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/data-table/data-table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { apiFetch, formatCurrency, formatDate } from '@/lib/api/client';
import type { PaginatedResponse } from '@/types';

interface AccountOption {
  id: string;
  name: string;
  code: string;
}

interface Transaction {
  id: string;
  reference: string;
  description: string;
  type: 'DEBIT' | 'CREDIT';
  amount: number | string;
  date: string;
  accountId: string;
  account?: { id: string; name: string; code: string };
}

const TRANSACTION_TYPES = ['DEBIT', 'CREDIT'] as const;

const today = () => new Date().toISOString().split('T')[0];

export function TransactionsPageClient() {
  const [data, setData] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [viewing, setViewing] = useState<Transaction | null>(null);
  const [form, setForm] = useState({
    reference: '',
    description: '',
    type: 'DEBIT' as typeof TRANSACTION_TYPES[number],
    amount: 0,
    date: today(),
    accountId: '',
  });
  const [saving, setSaving] = useState(false);

  const loadAccounts = useCallback(async () => {
    const res = await apiFetch<PaginatedResponse<AccountOption>>('/api/accounts?limit=100');
    if (res.success && res.data) setAccounts(res.data.items);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: '10', sortBy, sortOrder });
    if (search) qs.set('search', search);
    if (typeFilter) qs.set('type', typeFilter);
    const res = await apiFetch<PaginatedResponse<Transaction>>(`/api/transactions?${qs}`);
    if (res.success && res.data) {
      setData(res.data.items);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    }
    setLoading(false);
  }, [page, search, typeFilter, sortBy, sortOrder]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      reference: '',
      description: '',
      type: 'DEBIT',
      amount: 0,
      date: today(),
      accountId: accounts[0]?.id || '',
    });
    setDialogOpen(true);
  };

  const openEdit = (item: Transaction) => {
    setEditing(item);
    setForm({
      reference: item.reference,
      description: item.description,
      type: item.type,
      amount: Number(item.amount),
      date: item.date.split('T')[0],
      accountId: item.accountId,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.reference || !form.description || !form.accountId) {
      toast.error('Reference, description, and account are required');
      return;
    }
    if (form.amount <= 0) {
      toast.error('Amount must be positive');
      return;
    }
    setSaving(true);
    const url = editing ? `/api/transactions/${editing.id}` : '/api/transactions';
    const res = await apiFetch(url, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(form) });
    setSaving(false);
    if (res.success) {
      toast.success(editing ? 'Transaction updated' : 'Transaction created');
      setDialogOpen(false);
      load();
    } else {
      toast.error(res.error || 'Failed to save');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const res = await apiFetch(`/api/transactions/${deleteId}`, { method: 'DELETE' });
    if (res.success) {
      toast.success('Transaction deleted');
      setDeleteId(null);
      load();
    } else {
      toast.error(res.error || 'Failed to delete');
    }
  };

  const handleExport = (format: 'excel' | 'pdf') => {
    window.open(`/api/export?entity=transactions&format=${format}`, '_blank');
    toast.success(`Exporting transactions as ${format.toUpperCase()}`);
  };

  const handleSort = (key: string) => {
    if (sortBy === key) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortOrder('asc'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-muted-foreground text-sm">Record debits and credits against accounts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExport('excel')}><Download className="h-4 w-4" /> Excel</Button>
          <Button variant="outline" onClick={() => handleExport('pdf')}><Download className="h-4 w-4" /> PDF</Button>
          <Button onClick={openCreate}><Plus className="h-4 w-4" /> Create</Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="Search transactions..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="h-11 rounded-lg border border-input bg-background px-3 text-sm" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
          <option value="">All Types</option>
          {TRANSACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <DataTable
        columns={[
          { key: 'reference', label: 'Reference' },
          { key: 'description', label: 'Description' },
          {
            key: 'type',
            label: 'Type',
            render: (i) => (
              <Badge variant={i.type === 'CREDIT' ? 'success' : 'destructive'}>{i.type}</Badge>
            ),
          },
          { key: 'amount', label: 'Amount', render: (i) => formatCurrency(Number(i.amount)) },
          { key: 'date', label: 'Date', render: (i) => formatDate(i.date) },
          { key: 'account', label: 'Account', render: (i) => i.account ? `${i.account.code} — ${i.account.name}` : '—' },
        ]}
        data={data}
        loading={loading}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        onSort={handleSort}
        sortBy={sortBy}
        sortOrder={sortOrder}
        actions={(item) => (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" onClick={() => { setViewing(item); setViewOpen(true); }}><Eye className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => setDeleteId(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        )}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Transaction' : 'Create Transaction'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Reference *" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} disabled={saving} />
            <Input placeholder="Description *" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} disabled={saving} />
            <select className="w-full h-11 rounded-lg border px-3 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as typeof TRANSACTION_TYPES[number] })} disabled={saving}>
              {TRANSACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <Input placeholder="Amount *" type="number" min={0} step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} disabled={saving} />
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Date</label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} disabled={saving} />
            </div>
            <select className="w-full h-11 rounded-lg border px-3 text-sm" value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} disabled={saving}>
              <option value="">Select Account *</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} loading={saving} disabled={saving}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Transaction Details</DialogTitle></DialogHeader>
          {viewing && (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Reference</dt><dd>{viewing.reference}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Description</dt><dd>{viewing.description}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Type</dt><dd><Badge variant={viewing.type === 'CREDIT' ? 'success' : 'destructive'}>{viewing.type}</Badge></dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Amount</dt><dd>{formatCurrency(Number(viewing.amount))}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Date</dt><dd>{formatDate(viewing.date)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Account</dt><dd>{viewing.account ? `${viewing.account.code} — ${viewing.account.name}` : '—'}</dd></div>
            </dl>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
            <AlertDialogDescription>This will soft-delete the transaction record.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
