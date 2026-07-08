'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api, type PaginatedResponse } from '@/lib/api';
import { invalidateAfterMutation } from '@/lib/invalidate-dashboard';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PageHeader, LoadingSpinner, EmptyState } from '@/components/ui/stat-card';
import { ConfirmDialog, Modal } from '@/components/ui/modal';
import { useForm } from 'react-hook-form';

interface Expense {
  id: string;
  description: string;
  amount: number | string;
  category: string;
  status: string;
  expenseDate: string;
  project?: { name: string };
  creator?: { firstName: string; lastName: string };
}

const EXPENSE_CATEGORIES = [
  'MATERIAL', 'LABOUR', 'EQUIPMENT', 'CONSTRUCTION', 'OFFICE',
  'UTILITIES', 'TRANSPORT', 'MAINTENANCE', 'MARKETING', 'OTHER',
] as const;

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-50 text-yellow-700',
  APPROVED: 'bg-green-50 text-green-700',
  REJECTED: 'bg-red-50 text-red-700',
  PAID: 'bg-blue-50 text-blue-700',
};

export default function ExpensesPage() {
  const queryClient = useQueryClient();
  const [approveId, setApproveId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => api.get<PaginatedResponse<Expense>>('/expenses?limit=50'),
  });

  const { register, handleSubmit, reset } = useForm({
    defaultValues: { description: '', amount: 0, category: 'MATERIAL' as const },
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Expense>('/expenses', body),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['expenses']);
      toast.success('Expense created');
      setModalOpen(false);
      reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post<Expense>(`/expenses/${id}/approve`),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['expenses']);
      toast.success('Expense approved');
      setApproveId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Track and approve project expenses"
        action={
          <button className="btn-gold" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> New Expense
          </button>
        }
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : !data?.items.length ? (
        <EmptyState message="No expenses found." />
      ) : (
        <div className="luxury-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-luxury-border bg-luxury-cream">
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Description</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Category</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Project</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Date</th>
                  <th className="px-4 py-3 text-right font-medium text-luxury-slate">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((e) => (
                  <tr key={e.id} className="border-b border-luxury-border hover:bg-luxury-cream/50">
                    <td className="px-4 py-3">
                      <p className="font-medium">{e.description}</p>
                    </td>
                    <td className="px-4 py-3 text-luxury-slate">{e.category}</td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(Number(e.amount))}</td>
                    <td className="px-4 py-3 text-luxury-slate">{e.project?.name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[e.status] || 'bg-gray-50'}`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-luxury-slate">{formatDate(e.expenseDate)}</td>
                    <td className="px-4 py-3 text-right">
                      {e.status === 'PENDING' && (
                        <button className="btn-gold !px-3 !py-1.5" onClick={() => setApproveId(e.id)}>
                          <CheckCircle className="h-3.5 w-3.5" /> Approve
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Expense">
        <form
          onSubmit={handleSubmit((form) =>
            createMutation.mutate({
              description: form.description,
              amount: form.amount,
              category: form.category,
              expenseDate: new Date().toISOString(),
            })
          )}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <input {...register('description', { required: true })} className="luxury-input" placeholder="e.g. Cement supply for Phase 1" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Amount</label>
            <input {...register('amount', { valueAsNumber: true, min: 1, required: true })} type="number" className="luxury-input" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select {...register('category')} className="luxury-input">
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-gold" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!approveId}
        onClose={() => setApproveId(null)}
        onConfirm={() => approveId && approveMutation.mutate(approveId)}
        title="Approve Expense"
        message="Are you sure you want to approve this expense? This will update accounting records."
        confirmLabel="Approve"
        loading={approveMutation.isPending}
      />
    </div>
  );
}
