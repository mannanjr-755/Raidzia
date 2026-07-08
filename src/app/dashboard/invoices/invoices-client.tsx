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

interface CustomerOption {
  id: string;
  name: string;
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customer?: { id: string; name: string };
  status: string;
  issueDate: string;
  dueDate: string;
  taxRate: number | string;
  subtotal: number | string;
  taxAmount: number | string;
  total: number | string;
  notes?: string | null;
  items?: InvoiceItem[];
}

const INVOICE_STATUSES = ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'] as const;

function statusVariant(status: string): 'default' | 'secondary' | 'success' | 'warning' | 'destructive' {
  switch (status) {
    case 'PAID': return 'success';
    case 'SENT': return 'default';
    case 'OVERDUE': return 'warning';
    case 'CANCELLED': return 'destructive';
    default: return 'secondary';
  }
}

const defaultItem = (): InvoiceItem => ({ description: '', quantity: 1, unitPrice: 0 });

const today = () => new Date().toISOString().split('T')[0];

export function InvoicesPageClient() {
  const [data, setData] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [viewing, setViewing] = useState<Invoice | null>(null);
  const [form, setForm] = useState({
    customerId: '',
    status: 'DRAFT' as typeof INVOICE_STATUSES[number],
    issueDate: today(),
    dueDate: today(),
    taxRate: 0,
    notes: '',
    items: [defaultItem()] as InvoiceItem[],
  });
  const [saving, setSaving] = useState(false);

  const loadCustomers = useCallback(async () => {
    const res = await apiFetch<PaginatedResponse<CustomerOption>>('/api/customers?limit=100');
    if (res.success && res.data) setCustomers(res.data.items);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: '10', sortBy, sortOrder });
    if (search) qs.set('search', search);
    if (statusFilter) qs.set('status', statusFilter);
    const res = await apiFetch<PaginatedResponse<Invoice>>(`/api/invoices?${qs}`);
    if (res.success && res.data) {
      setData(res.data.items);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    }
    setLoading(false);
  }, [page, search, statusFilter, sortBy, sortOrder]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      customerId: customers[0]?.id || '',
      status: 'DRAFT',
      issueDate: today(),
      dueDate: today(),
      taxRate: 0,
      notes: '',
      items: [defaultItem()],
    });
    setDialogOpen(true);
  };

  const openEdit = async (item: Invoice) => {
    const res = await apiFetch<Invoice>(`/api/invoices/${item.id}`);
    if (!res.success || !res.data) {
      toast.error('Failed to load invoice');
      return;
    }
    const inv = res.data;
    setEditing(inv);
    setForm({
      customerId: inv.customerId,
      status: inv.status as typeof INVOICE_STATUSES[number],
      issueDate: inv.issueDate.split('T')[0],
      dueDate: inv.dueDate.split('T')[0],
      taxRate: Number(inv.taxRate),
      notes: inv.notes || '',
      items: inv.items?.length ? inv.items.map((i) => ({
        description: i.description,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
      })) : [defaultItem()],
    });
    setDialogOpen(true);
  };

  const openView = async (item: Invoice) => {
    const res = await apiFetch<Invoice>(`/api/invoices/${item.id}`);
    if (res.success && res.data) {
      setViewing(res.data);
      setViewOpen(true);
    } else {
      toast.error('Failed to load invoice');
    }
  };

  const handleSave = async () => {
    if (!form.customerId) {
      toast.error('Customer is required');
      return;
    }
    if (!form.items.length || form.items.some((i) => !i.description)) {
      toast.error('All line items need a description');
      return;
    }
    setSaving(true);
    const url = editing ? `/api/invoices/${editing.id}` : '/api/invoices';
    const res = await apiFetch(url, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(form) });
    setSaving(false);
    if (res.success) {
      toast.success(editing ? 'Invoice updated' : 'Invoice created');
      setDialogOpen(false);
      load();
    } else {
      toast.error(res.error || 'Failed to save');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const res = await apiFetch(`/api/invoices/${deleteId}`, { method: 'DELETE' });
    if (res.success) {
      toast.success('Invoice deleted');
      setDeleteId(null);
      load();
    } else {
      toast.error(res.error || 'Failed to delete');
    }
  };

  const handleExport = (format: 'excel' | 'pdf') => {
    window.open(`/api/export?entity=invoices&format=${format}`, '_blank');
    toast.success(`Exporting invoices as ${format.toUpperCase()}`);
  };

  const handleSort = (key: string) => {
    if (sortBy === key) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortOrder('asc'); }
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const items = [...form.items];
    items[index] = { ...items[index], [field]: value };
    setForm({ ...form, items });
  };

  const addItem = () => setForm({ ...form, items: [...form.items, defaultItem()] });
  const removeItem = (index: number) => {
    if (form.items.length <= 1) return;
    setForm({ ...form, items: form.items.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-muted-foreground text-sm">Create and manage customer invoices</p>
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
          <Input className="pl-10" placeholder="Search invoices..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="h-11 rounded-lg border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {INVOICE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <DataTable
        columns={[
          { key: 'invoiceNumber', label: 'Number' },
          { key: 'customer', label: 'Customer', render: (i) => i.customer?.name || '—' },
          {
            key: 'status',
            label: 'Status',
            render: (i) => <Badge variant={statusVariant(i.status)}>{i.status}</Badge>,
          },
          { key: 'issueDate', label: 'Issue Date', render: (i) => formatDate(i.issueDate) },
          { key: 'dueDate', label: 'Due Date', render: (i) => formatDate(i.dueDate) },
          { key: 'total', label: 'Total', render: (i) => formatCurrency(Number(i.total)) },
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
            <Button variant="ghost" size="icon" onClick={() => openView(item)}><Eye className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => setDeleteId(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        )}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Invoice' : 'Create Invoice'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <select className="w-full h-11 rounded-lg border px-3 text-sm" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} disabled={saving}>
              <option value="">Select Customer *</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="w-full h-11 rounded-lg border px-3 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as typeof INVOICE_STATUSES[number] })} disabled={saving}>
              {INVOICE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Issue Date</label>
                <Input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} disabled={saving} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Due Date</label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} disabled={saving} />
              </div>
            </div>
            <Input placeholder="Tax Rate (%)" type="number" min={0} max={100} value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: Number(e.target.value) })} disabled={saving} />
            <Input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} disabled={saving} />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Line Items</span>
                <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={saving}>Add Item</Button>
              </div>
              {form.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <Input className="col-span-5" placeholder="Description *" value={item.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} disabled={saving} />
                  <Input className="col-span-2" placeholder="Qty" type="number" min={1} value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))} disabled={saving} />
                  <Input className="col-span-3" placeholder="Unit Price" type="number" min={0} step="0.01" value={item.unitPrice} onChange={(e) => updateItem(idx, 'unitPrice', Number(e.target.value))} disabled={saving} />
                  <Button type="button" variant="ghost" size="icon" className="col-span-2" onClick={() => removeItem(idx)} disabled={saving || form.items.length <= 1}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} loading={saving} disabled={saving}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Invoice Details</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-4 text-sm">
              <dl className="space-y-2">
                <div className="flex justify-between"><dt className="text-muted-foreground">Number</dt><dd>{viewing.invoiceNumber}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Customer</dt><dd>{viewing.customer?.name || '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Status</dt><dd><Badge variant={statusVariant(viewing.status)}>{viewing.status}</Badge></dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Issue Date</dt><dd>{formatDate(viewing.issueDate)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Due Date</dt><dd>{formatDate(viewing.dueDate)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{formatCurrency(Number(viewing.subtotal))}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Tax ({Number(viewing.taxRate)}%)</dt><dd>{formatCurrency(Number(viewing.taxAmount))}</dd></div>
                <div className="flex justify-between font-medium"><dt className="text-muted-foreground">Total</dt><dd>{formatCurrency(Number(viewing.total))}</dd></div>
                {viewing.notes && <div className="flex justify-between"><dt className="text-muted-foreground">Notes</dt><dd>{viewing.notes}</dd></div>}
              </dl>
              {viewing.items && viewing.items.length > 0 && (
                <div>
                  <p className="font-medium mb-2">Line Items</p>
                  <div className="rounded-lg border divide-y">
                    {viewing.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between px-3 py-2">
                        <span>{item.description} × {item.quantity}</span>
                        <span>{formatCurrency(Number(item.quantity) * Number(item.unitPrice))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice?</AlertDialogTitle>
            <AlertDialogDescription>This will cancel and soft-delete the invoice.</AlertDialogDescription>
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
