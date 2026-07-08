'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Search, Download, Pencil, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { apiFetch, formatCurrency } from '@/lib/api/client';
import type { PaginatedResponse } from '@/types';

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  balance: number | string;
  description?: string;
  isActive: boolean;
}

const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];

export function AccountsPageClient() {
  const [data, setData] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Account | null>(null);
  const [viewing, setViewing] = useState<Account | null>(null);
  const [form, setForm] = useState({ code: '', name: '', type: 'ASSET', description: '', balance: 0, isActive: true });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: '10', sortBy, sortOrder });
    if (search) qs.set('search', search);
    if (typeFilter) qs.set('type', typeFilter);
    const res = await apiFetch<PaginatedResponse<Account>>(`/api/accounts?${qs}`);
    if (res.success && res.data) {
      setData(res.data.items);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    }
    setLoading(false);
  }, [page, search, typeFilter, sortBy, sortOrder]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ code: '', name: '', type: 'ASSET', description: '', balance: 0, isActive: true });
    setDialogOpen(true);
  };

  const openEdit = (item: Account) => {
    setEditing(item);
    setForm({
      code: item.code,
      name: item.name,
      type: item.type,
      description: item.description || '',
      balance: Number(item.balance),
      isActive: item.isActive,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.name) {
      toast.error('Code and name are required');
      return;
    }
    setSaving(true);
    const url = editing ? `/api/accounts/${editing.id}` : '/api/accounts';
    const res = await apiFetch(url, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(form) });
    setSaving(false);
    if (res.success) {
      toast.success(editing ? 'Account updated' : 'Account created');
      setDialogOpen(false);
      load();
    } else {
      toast.error(res.error || 'Failed to save');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const res = await apiFetch(`/api/accounts/${deleteId}`, { method: 'DELETE' });
    if (res.success) {
      toast.success('Account deleted');
      setDeleteId(null);
      load();
    } else {
      toast.error(res.error || 'Failed to delete');
    }
  };

  const handleExport = (format: 'excel' | 'pdf') => {
    window.open(`/api/export?entity=accounts&format=${format}`, '_blank');
    toast.success(`Exporting accounts as ${format.toUpperCase()}`);
  };

  const handleSort = (key: string) => {
    if (sortBy === key) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortOrder('asc'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Chart of Accounts</h1>
          <p className="text-muted-foreground text-sm">Manage your accounting accounts</p>
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
          <Input className="pl-10" placeholder="Search accounts..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="h-11 rounded-lg border border-input bg-background px-3 text-sm" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
          <option value="">All Types</option>
          {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <DataTable
        columns={[
          { key: 'code', label: 'Code' },
          { key: 'name', label: 'Name' },
          { key: 'type', label: 'Type' },
          { key: 'balance', label: 'Balance', render: (i) => formatCurrency(Number(i.balance)) },
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
          <DialogHeader><DialogTitle>{editing ? 'Edit Account' : 'Create Account'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Account Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={saving} />
            <Input placeholder="Account Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={saving} />
            <select className="w-full h-11 rounded-lg border px-3 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} disabled={saving}>
              {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <Input placeholder="Opening Balance" type="number" value={form.balance} onChange={(e) => setForm({ ...form, balance: Number(e.target.value) })} disabled={saving} />
            <Input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} disabled={saving} />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} loading={saving} disabled={saving}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Account Details</DialogTitle></DialogHeader>
          {viewing && (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Code</dt><dd>{viewing.code}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Name</dt><dd>{viewing.name}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Type</dt><dd>{viewing.type}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Balance</dt><dd>{formatCurrency(Number(viewing.balance))}</dd></div>
              {viewing.description && <div className="flex justify-between"><dt className="text-muted-foreground">Description</dt><dd>{viewing.description}</dd></div>}
            </dl>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account?</AlertDialogTitle>
            <AlertDialogDescription>This will soft-delete the account. This action can be reversed by an administrator.</AlertDialogDescription>
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
