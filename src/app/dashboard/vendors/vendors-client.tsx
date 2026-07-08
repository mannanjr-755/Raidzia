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
import { apiFetch, formatCurrency } from '@/lib/api/client';
import type { PaginatedResponse } from '@/types';

interface Vendor {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxId?: string | null;
  balance: number | string;
  isActive: boolean;
}

export function VendorsPageClient() {
  const [data, setData] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [viewing, setViewing] = useState<Vendor | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', taxId: '', balance: 0, isActive: true });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: '10', sortBy, sortOrder });
    if (search) qs.set('search', search);
    const res = await apiFetch<PaginatedResponse<Vendor>>(`/api/vendors?${qs}`);
    if (res.success && res.data) {
      setData(res.data.items);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    }
    setLoading(false);
  }, [page, search, sortBy, sortOrder]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', email: '', phone: '', address: '', taxId: '', balance: 0, isActive: true });
    setDialogOpen(true);
  };

  const openEdit = (item: Vendor) => {
    setEditing(item);
    setForm({
      name: item.name,
      email: item.email || '',
      phone: item.phone || '',
      address: item.address || '',
      taxId: item.taxId || '',
      balance: Number(item.balance),
      isActive: item.isActive,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) {
      toast.error('Vendor name is required');
      return;
    }
    setSaving(true);
    const url = editing ? `/api/vendors/${editing.id}` : '/api/vendors';
    const res = await apiFetch(url, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(form) });
    setSaving(false);
    if (res.success) {
      toast.success(editing ? 'Vendor updated' : 'Vendor created');
      setDialogOpen(false);
      load();
    } else {
      toast.error(res.error || 'Failed to save');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const res = await apiFetch(`/api/vendors/${deleteId}`, { method: 'DELETE' });
    if (res.success) {
      toast.success('Vendor deleted');
      setDeleteId(null);
      load();
    } else {
      toast.error(res.error || 'Failed to delete');
    }
  };

  const handleExport = (format: 'excel' | 'pdf') => {
    window.open(`/api/export?entity=vendors&format=${format}`, '_blank');
    toast.success(`Exporting vendors as ${format.toUpperCase()}`);
  };

  const handleSort = (key: string) => {
    if (sortBy === key) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortOrder('asc'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Vendors</h1>
          <p className="text-muted-foreground text-sm">Manage vendor records and payables</p>
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
          <Input className="pl-10" placeholder="Search vendors..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      <DataTable
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email', render: (i) => i.email || '—' },
          { key: 'phone', label: 'Phone', render: (i) => i.phone || '—' },
          { key: 'balance', label: 'Balance', render: (i) => formatCurrency(Number(i.balance)) },
          {
            key: 'isActive',
            label: 'Status',
            render: (i) => (
              <Badge variant={i.isActive ? 'success' : 'secondary'}>{i.isActive ? 'Active' : 'Inactive'}</Badge>
            ),
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
          <DialogHeader><DialogTitle>{editing ? 'Edit Vendor' : 'Create Vendor'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Vendor Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={saving} />
            <Input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={saving} />
            <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={saving} />
            <Input placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} disabled={saving} />
            <Input placeholder="Tax ID" value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} disabled={saving} />
            <Input placeholder="Balance" type="number" value={form.balance} onChange={(e) => setForm({ ...form, balance: Number(e.target.value) })} disabled={saving} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} disabled={saving} />
              Active
            </label>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} loading={saving} disabled={saving}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Vendor Details</DialogTitle></DialogHeader>
          {viewing && (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Name</dt><dd>{viewing.name}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Email</dt><dd>{viewing.email || '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Phone</dt><dd>{viewing.phone || '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Address</dt><dd>{viewing.address || '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Tax ID</dt><dd>{viewing.taxId || '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Balance</dt><dd>{formatCurrency(Number(viewing.balance))}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Status</dt><dd><Badge variant={viewing.isActive ? 'success' : 'secondary'}>{viewing.isActive ? 'Active' : 'Inactive'}</Badge></dd></div>
            </dl>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vendor?</AlertDialogTitle>
            <AlertDialogDescription>This will soft-delete the vendor. This action can be reversed by an administrator.</AlertDialogDescription>
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
