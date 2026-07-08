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

interface VendorOption {
  id: string;
  name: string;
}

interface AccountOption {
  id: string;
  name: string;
  code: string;
}

interface Expense {
  id: string;
  description: string;
  amount: number | string;
  category: string;
  status: string;
  expenseDate: string;
  vendorId?: string | null;
  accountId?: string | null;
  vendor?: { id: string; name: string } | null;
  account?: { id: string; name: string } | null;
}

const EXPENSE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'PAID'] as const;
const EXPENSE_CATEGORIES = ['Rent', 'Technology', 'Travel', 'Office', 'Utilities', 'Supplies', 'Other'];

function statusVariant(status: string): 'default' | 'secondary' | 'success' | 'warning' | 'destructive' {
  switch (status) {
    case 'PAID': return 'success';
    case 'APPROVED': return 'default';
    case 'PENDING': return 'warning';
    case 'REJECTED': return 'destructive';
    default: return 'secondary';
  }
}

const today = () => new Date().toISOString().split('T')[0];

export function ExpensesPageClient() {
  const [data, setData] = useState<Expense[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortBy, setSortBy] = useState('expenseDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [viewing, setViewing] = useState<Expense | null>(null);
  const [form, setForm] = useState({
    description: '',
    amount: 0,
    category: 'Other',
    status: 'PENDING' as typeof EXPENSE_STATUSES[number],
    expenseDate: today(),
    vendorId: '',
    accountId: '',
  });
  const [saving, setSaving] = useState(false);

  const loadOptions = useCallback(async () => {
    const [vRes, aRes] = await Promise.all([
      apiFetch<PaginatedResponse<VendorOption>>('/api/vendors?limit=100'),
      apiFetch<PaginatedResponse<AccountOption>>('/api/accounts?limit=100'),
    ]);
    if (vRes.success && vRes.data) setVendors(vRes.data.items);
    if (aRes.success && aRes.data) setAccounts(aRes.data.items);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: '10', sortBy, sortOrder });
    if (search) qs.set('search', search);
    if (statusFilter) qs.set('status', statusFilter);
    if (categoryFilter) qs.set('category', categoryFilter);
    const res = await apiFetch<PaginatedResponse<Expense>>(`/api/expenses?${qs}`);
    if (res.success && res.data) {
      setData(res.data.items);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    }
    setLoading(false);
  }, [page, search, statusFilter, categoryFilter, sortBy, sortOrder]);

  useEffect(() => { loadOptions(); }, [loadOptions]);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      description: '',
      amount: 0,
      category: 'Other',
      status: 'PENDING',
      expenseDate: today(),
      vendorId: '',
      accountId: '',
    });
    setDialogOpen(true);
  };

  const openEdit = (item: Expense) => {
    setEditing(item);
    setForm({
      description: item.description,
      amount: Number(item.amount),
      category: item.category,
      status: item.status as typeof EXPENSE_STATUSES[number],
      expenseDate: item.expenseDate.split('T')[0],
      vendorId: item.vendorId || '',
      accountId: item.accountId || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.description || !form.category) {
      toast.error('Description and category are required');
      return;
    }
    if (form.amount <= 0) {
      toast.error('Amount must be positive');
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      vendorId: form.vendorId || null,
      accountId: form.accountId || null,
    };
    const url = editing ? `/api/expenses/${editing.id}` : '/api/expenses';
    const res = await apiFetch(url, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    setSaving(false);
    if (res.success) {
      toast.success(editing ? 'Expense updated' : 'Expense created');
      setDialogOpen(false);
      load();
    } else {
      toast.error(res.error || 'Failed to save');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const res = await apiFetch(`/api/expenses/${deleteId}`, { method: 'DELETE' });
    if (res.success) {
      toast.success('Expense deleted');
      setDeleteId(null);
      load();
    } else {
      toast.error(res.error || 'Failed to delete');
    }
  };

  const handleExport = (format: 'excel' | 'pdf') => {
    window.open(`/api/export?entity=expenses&format=${format}`, '_blank');
    toast.success(`Exporting expenses as ${format.toUpperCase()}`);
  };

  const handleSort = (key: string) => {
    if (sortBy === key) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortOrder('asc'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Expenses</h1>
          <p className="text-muted-foreground text-sm">Track and manage business expenses</p>
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
          <Input className="pl-10" placeholder="Search expenses..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="h-11 rounded-lg border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {EXPENSE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="h-11 rounded-lg border border-input bg-background px-3 text-sm" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}>
          <option value="">All Categories</option>
          {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <DataTable
        columns={[
          { key: 'description', label: 'Description' },
          { key: 'category', label: 'Category' },
          { key: 'vendor', label: 'Vendor', render: (i) => i.vendor?.name || '—' },
          { key: 'amount', label: 'Amount', render: (i) => formatCurrency(Number(i.amount)) },
          { key: 'expenseDate', label: 'Date', render: (i) => formatDate(i.expenseDate) },
          {
            key: 'status',
            label: 'Status',
            render: (i) => <Badge variant={statusVariant(i.status)}>{i.status}</Badge>,
          },
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
          <DialogHeader><DialogTitle>{editing ? 'Edit Expense' : 'Create Expense'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Description *" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} disabled={saving} />
            <Input placeholder="Amount *" type="number" min={0} step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} disabled={saving} />
            <select className="w-full h-11 rounded-lg border px-3 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} disabled={saving}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="w-full h-11 rounded-lg border px-3 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as typeof EXPENSE_STATUSES[number] })} disabled={saving}>
              {EXPENSE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Expense Date</label>
              <Input type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} disabled={saving} />
            </div>
            <select className="w-full h-11 rounded-lg border px-3 text-sm" value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })} disabled={saving}>
              <option value="">No Vendor</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <select className="w-full h-11 rounded-lg border px-3 text-sm" value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} disabled={saving}>
              <option value="">No Account</option>
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
          <DialogHeader><DialogTitle>Expense Details</DialogTitle></DialogHeader>
          {viewing && (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Description</dt><dd>{viewing.description}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Category</dt><dd>{viewing.category}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Amount</dt><dd>{formatCurrency(Number(viewing.amount))}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Date</dt><dd>{formatDate(viewing.expenseDate)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Vendor</dt><dd>{viewing.vendor?.name || '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Account</dt><dd>{viewing.account?.name || '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Status</dt><dd><Badge variant={statusVariant(viewing.status)}>{viewing.status}</Badge></dd></div>
            </dl>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense?</AlertDialogTitle>
            <AlertDialogDescription>This will soft-delete the expense record.</AlertDialogDescription>
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
