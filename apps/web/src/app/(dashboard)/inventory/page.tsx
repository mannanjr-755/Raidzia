'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowDownToLine, ArrowUpFromLine, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, type PaginatedResponse } from '@/lib/api';
import { invalidateAfterMutation } from '@/lib/invalidate-dashboard';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { PageHeader, LoadingSpinner, EmptyState } from '@/components/ui/stat-card';
import { Modal, ConfirmDialog } from '@/components/ui/modal';
import { ListToolbar, PaginationBar } from '@/components/ui/list-controls';
import { useListParams } from '@/hooks/use-list-params';

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  quantity: number | string;
  unit: string;
  minStock: number | string;
  unitCost?: number | string;
  barcode?: string;
  warehouse?: string;
}

const INVENTORY_CATEGORIES = ['MATERIAL', 'TOOL', 'EQUIPMENT', 'CONSUMABLE', 'OTHER'] as const;

const inventorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  sku: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  unit: z.string().min(1),
  quantity: z.coerce.number().min(0),
  minStock: z.coerce.number().min(0),
  unitCost: z.coerce.number().min(0).optional(),
  barcode: z.string().optional(),
  warehouse: z.string().optional(),
});

type InventoryForm = z.infer<typeof inventorySchema>;

const stockSchema = z.object({
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
  notes: z.string().optional(),
});

type StockForm = z.infer<typeof stockSchema>;

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const list = useListParams(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [stockModal, setStockModal] = useState<{ item: InventoryItem; type: 'in' | 'out' } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', list.queryString],
    queryFn: () => api.get<PaginatedResponse<InventoryItem>>(`/inventory?${list.queryString}`),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InventoryForm>({
    resolver: zodResolver(inventorySchema),
    defaultValues: {
      name: '',
      sku: '',
      category: 'MATERIAL',
      unit: 'pcs',
      quantity: 0,
      minStock: 10,
      unitCost: 0,
      barcode: '',
      warehouse: '',
    },
  });

  const stockForm = useForm<StockForm>({
    resolver: zodResolver(stockSchema),
    defaultValues: { quantity: 1, notes: '' },
  });

  const createMutation = useMutation({
    mutationFn: (body: InventoryForm) => api.post<InventoryItem>('/inventory', body),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['inventory']);
      toast.success('Item created');
      closeModal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: InventoryForm }) =>
      api.put<InventoryItem>(`/inventory/${id}`, body),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['inventory']);
      toast.success('Item updated');
      closeModal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/${id}`),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['inventory']);
      toast.success('Item deleted');
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stockMutation = useMutation({
    mutationFn: ({ id, type, body }: { id: string; type: 'in' | 'out'; body: StockForm }) =>
      api.post<InventoryItem>(`/inventory/${id}/stock-${type}`, body),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['inventory']);
      toast.success(stockModal?.type === 'in' ? 'Stock added' : 'Stock removed');
      setStockModal(null);
      stockForm.reset({ quantity: 1, notes: '' });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditing(null);
    reset({
      name: '',
      sku: '',
      category: 'MATERIAL',
      unit: 'pcs',
      quantity: 0,
      minStock: 10,
      unitCost: 0,
      barcode: '',
      warehouse: '',
    });
    setModalOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditing(item);
    reset({
      name: item.name,
      sku: item.sku,
      category: item.category,
      unit: item.unit,
      quantity: Number(item.quantity),
      minStock: Number(item.minStock),
      unitCost: Number(item.unitCost || 0),
      barcode: item.barcode || '',
      warehouse: item.warehouse || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const onSubmit = (form: InventoryForm) => {
    if (editing) updateMutation.mutate({ id: editing.id, body: form });
    else createMutation.mutate(form);
  };

  const openStock = (item: InventoryItem, type: 'in' | 'out') => {
    stockForm.reset({ quantity: 1, notes: '' });
    setStockModal({ item, type });
  };

  const isLowStock = (item: InventoryItem) => Number(item.quantity) <= Number(item.minStock);

  return (
    <div>
      <PageHeader title="Inventory" description="Manage construction materials and stock movements" />

      <ListToolbar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search by name, SKU, or barcode..."
        filters={[
          {
            key: 'category',
            label: 'All categories',
            value: list.filters.category || '',
            onChange: (v) => list.setFilter('category', v),
            options: INVENTORY_CATEGORIES.map((c) => ({ label: c, value: c })),
          },
        ]}
        action={
          <button className="btn-gold" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Item
          </button>
        }
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : !data?.items.length ? (
        <EmptyState message="No inventory items found." />
      ) : (
        <div className="luxury-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-luxury-border bg-luxury-cream">
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">SKU</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Category</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Quantity</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Min Stock</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Unit Cost</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Warehouse</th>
                  <th className="px-4 py-3 text-right font-medium text-luxury-slate">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr
                    key={item.id}
                    className={`border-b border-luxury-border hover:bg-luxury-cream/50 ${isLowStock(item) ? 'bg-orange-50/40' : ''}`}
                  >
                    <td className="px-4 py-3 font-mono text-gold">{item.sku}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{item.name}</p>
                      {isLowStock(item) && (
                        <span className="text-xs text-orange-700">Low stock</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-luxury-slate">{item.category}</td>
                    <td className="px-4 py-3 font-medium">
                      {formatNumber(Number(item.quantity))} {item.unit}
                    </td>
                    <td className="px-4 py-3 text-luxury-slate">{formatNumber(Number(item.minStock))}</td>
                    <td className="px-4 py-3">{formatCurrency(Number(item.unitCost || 0))}</td>
                    <td className="px-4 py-3 text-luxury-slate">{item.warehouse || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button className="btn-gold !px-2 !py-1.5" onClick={() => openStock(item, 'in')} title="Stock In">
                          <ArrowDownToLine className="h-3.5 w-3.5" />
                        </button>
                        <button className="btn-outline !px-2 !py-1.5" onClick={() => openStock(item, 'out')} title="Stock Out">
                          <ArrowUpFromLine className="h-3.5 w-3.5" />
                        </button>
                        <button className="btn-outline !px-2 !py-1.5" onClick={() => openEdit(item)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button className="btn-danger !px-2 !py-1.5" onClick={() => setDeleteId(item.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data && (
        <PaginationBar
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          limit={data.limit}
          onPageChange={list.setPage}
        />
      )}

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Item' : 'Add Inventory Item'} className="max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input {...register('name')} className="luxury-input" />
              {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">SKU</label>
              <input {...register('sku')} className="luxury-input" placeholder="Auto-generated if blank" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select {...register('category')} className="luxury-input">
                {INVENTORY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Unit</label>
              <input {...register('unit')} className="luxury-input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Quantity</label>
              <input {...register('quantity')} type="number" className="luxury-input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Min Stock</label>
              <input {...register('minStock')} type="number" className="luxury-input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Unit Cost</label>
              <input {...register('unitCost')} type="number" step="0.01" className="luxury-input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Warehouse</label>
              <input {...register('warehouse')} className="luxury-input" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Barcode</label>
              <input {...register('barcode')} className="luxury-input" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-outline" onClick={closeModal}>Cancel</button>
            <button type="submit" className="btn-gold" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editing ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!stockModal}
        onClose={() => setStockModal(null)}
        title={stockModal?.type === 'in' ? 'Stock In' : 'Stock Out'}
      >
        {stockModal && (
          <form
            onSubmit={stockForm.handleSubmit((form) =>
              stockMutation.mutate({
                id: stockModal.item.id,
                type: stockModal.type,
                body: form,
              })
            )}
            className="space-y-4"
          >
            <p className="text-sm text-luxury-slate">
              {stockModal.item.name} — Current:{' '}
              {formatNumber(Number(stockModal.item.quantity))} {stockModal.item.unit}
            </p>
            <div>
              <label className="block text-sm font-medium mb-1">Quantity</label>
              <input {...stockForm.register('quantity')} type="number" className="luxury-input" />
              {stockForm.formState.errors.quantity && (
                <p className="text-xs text-red-600 mt-1">{stockForm.formState.errors.quantity.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea {...stockForm.register('notes')} className="luxury-input min-h-[60px]" />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-outline" onClick={() => setStockModal(null)}>Cancel</button>
              <button type="submit" className="btn-gold" disabled={stockMutation.isPending}>
                {stockMutation.isPending ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Delete Item"
        message="Are you sure you want to delete this inventory item?"
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
