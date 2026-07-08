'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDownToLine, ArrowUpFromLine, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { invalidateAfterMutation } from '@/lib/invalidate-dashboard';
import { formatNumber } from '@/lib/utils';
import { PageHeader, LoadingSpinner, EmptyState } from '@/components/ui/stat-card';
import { Modal } from '@/components/ui/modal';
import { useForm } from 'react-hook-form';

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  quantity: number | string;
  unit: string;
  minStock: number | string;
  location?: string;
}

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [stockModal, setStockModal] = useState<{ item: InventoryItem; type: 'in' | 'out' } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get<InventoryItem[]>('/inventory'),
  });

  const { register, handleSubmit, reset } = useForm({
    defaultValues: { quantity: 1, notes: '' },
  });

  const createForm = useForm({
    defaultValues: { name: '', sku: '', category: 'MATERIAL', unit: 'pcs', quantity: 0, minStock: 10 },
  });

  const stockMutation = useMutation({
    mutationFn: ({ id, type, body }: { id: string; type: 'in' | 'out'; body: { quantity: number; notes?: string } }) =>
      api.post<InventoryItem>(`/inventory/${id}/stock-${type}`, body),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['inventory']);
      toast.success(stockModal?.type === 'in' ? 'Stock added' : 'Stock removed');
      setStockModal(null);
      reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<InventoryItem>('/inventory', body),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['inventory']);
      toast.success('Item created');
      setCreateOpen(false);
      createForm.reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isLowStock = (item: InventoryItem) => Number(item.quantity) <= Number(item.minStock);

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Manage construction materials and stock movements"
        action={
          <button className="btn-gold" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Add Item
          </button>
        }
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : !data?.length ? (
        <EmptyState message="No inventory items found." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((item) => (
            <div
              key={item.id}
              className={`luxury-card p-5 ${isLowStock(item) ? 'ring-2 ring-orange-200' : ''}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs font-mono text-gold">{item.sku}</p>
                  <h3 className="font-semibold text-luxury-charcoal">{item.name}</h3>
                  <p className="text-xs text-luxury-slate">{item.category}</p>
                </div>
                {isLowStock(item) && (
                  <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-700">Low Stock</span>
                )}
              </div>
              <div className="mb-4">
                <p className="text-2xl font-bold text-luxury-charcoal">
                  {formatNumber(Number(item.quantity))}
                  <span className="text-sm font-normal text-luxury-slate ml-1">{item.unit}</span>
                </p>
                <p className="text-xs text-luxury-slate">Min: {formatNumber(Number(item.minStock))}</p>
              </div>
              <div className="flex gap-2">
                <button
                  className="btn-gold flex-1 !py-2"
                  onClick={() => {
                    reset({ quantity: 1, notes: '' });
                    setStockModal({ item, type: 'in' });
                  }}
                >
                  <ArrowDownToLine className="h-3.5 w-3.5" /> Stock In
                </button>
                <button
                  className="btn-outline flex-1 !py-2"
                  onClick={() => {
                    reset({ quantity: 1, notes: '' });
                    setStockModal({ item, type: 'out' });
                  }}
                >
                  <ArrowUpFromLine className="h-3.5 w-3.5" /> Stock Out
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!stockModal}
        onClose={() => setStockModal(null)}
        title={stockModal?.type === 'in' ? 'Stock In' : 'Stock Out'}
      >
        {stockModal && (
          <form
            onSubmit={handleSubmit((form) =>
              stockMutation.mutate({
                id: stockModal.item.id,
                type: stockModal.type,
                body: { quantity: form.quantity, notes: form.notes },
              })
            )}
            className="space-y-4"
          >
            <p className="text-sm text-luxury-slate">
              {stockModal.item.name} — Current: {formatNumber(Number(stockModal.item.quantity))} {stockModal.item.unit}
            </p>
            <div>
              <label className="block text-sm font-medium mb-1">Quantity</label>
              <input {...register('quantity', { valueAsNumber: true, min: 1 })} type="number" className="luxury-input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea {...register('notes')} className="luxury-input min-h-[60px]" />
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

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add Inventory Item">
        <form
          onSubmit={createForm.handleSubmit((form) => createMutation.mutate(form))}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input {...createForm.register('name', { required: true })} className="luxury-input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">SKU</label>
              <input {...createForm.register('sku')} className="luxury-input" placeholder="Auto-generated if left blank" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select {...createForm.register('category')} className="luxury-input">
                {['MATERIAL', 'TOOL', 'EQUIPMENT', 'CONSUMABLE'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Unit</label>
              <input {...createForm.register('unit')} className="luxury-input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Initial Quantity</label>
              <input {...createForm.register('quantity', { valueAsNumber: true })} type="number" className="luxury-input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Min Stock</label>
              <input {...createForm.register('minStock', { valueAsNumber: true })} type="number" className="luxury-input" />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-outline" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="submit" className="btn-gold" disabled={createMutation.isPending}>Create</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
