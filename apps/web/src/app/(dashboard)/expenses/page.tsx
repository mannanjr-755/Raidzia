'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, type PaginatedResponse } from '@/lib/api';
import { invalidateAfterMutation } from '@/lib/invalidate-dashboard';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PageHeader, LoadingSpinner, EmptyState } from '@/components/ui/stat-card';
import { Modal, ConfirmDialog } from '@/components/ui/modal';
import { ListToolbar, PaginationBar } from '@/components/ui/list-controls';
import { useListParams } from '@/hooks/use-list-params';

interface Expense {
  id: string;
  description: string;
  amount: number | string;
  category: string;
  status: string;
  expenseDate: string;
  projectId?: string | null;
  project?: { name: string };
  creator?: { firstName: string; lastName: string };
}

interface ProjectOption {
  id: string;
  name: string;
  code: string;
}

const EXPENSE_CATEGORIES = [
  'MATERIAL', 'LABOUR', 'EQUIPMENT', 'CONSTRUCTION', 'OFFICE',
  'UTILITIES', 'TRANSPORT', 'MAINTENANCE', 'MARKETING', 'OTHER',
  'FUEL', 'ELECTRICITY', 'WATER',
] as const;

const EXPENSE_STATUSES = ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PAID'] as const;

const expenseSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  category: z.enum(EXPENSE_CATEGORIES),
  status: z.enum(EXPENSE_STATUSES).optional(),
  expenseDate: z.string().optional(),
  projectId: z.string().optional().nullable(),
});

type ExpenseForm = z.infer<typeof expenseSchema>;

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-50 text-gray-700',
  PENDING: 'bg-yellow-50 text-yellow-700',
  APPROVED: 'bg-green-50 text-green-700',
  REJECTED: 'bg-red-50 text-red-700',
  PAID: 'bg-blue-50 text-blue-700',
};

export default function ExpensesPage() {
  const queryClient = useQueryClient();
  const list = useListParams(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [approveId, setApproveId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', list.queryString],
    queryFn: () => api.get<PaginatedResponse<Expense>>(`/expenses?${list.queryString}`),
  });

  const { data: projects } = useQuery({
    queryKey: ['projects-options'],
    queryFn: () => api.get<PaginatedResponse<ProjectOption>>('/projects?limit=100'),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      description: '',
      amount: 0,
      category: 'MATERIAL',
      status: 'PENDING',
      expenseDate: new Date().toISOString().split('T')[0],
      projectId: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: ExpenseForm) =>
      api.post<Expense>('/expenses', {
        ...body,
        projectId: body.projectId || null,
      }),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['expenses']);
      toast.success('Expense created');
      closeModal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ExpenseForm }) =>
      api.put<Expense>(`/expenses/${id}`, {
        ...body,
        projectId: body.projectId || null,
      }),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['expenses']);
      toast.success('Expense updated');
      closeModal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['expenses']);
      toast.success('Expense deleted');
      setDeleteId(null);
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

  const openCreate = () => {
    setEditing(null);
    reset({
      description: '',
      amount: 0,
      category: 'MATERIAL',
      status: 'PENDING',
      expenseDate: new Date().toISOString().split('T')[0],
      projectId: '',
    });
    setModalOpen(true);
  };

  const openEdit = (expense: Expense) => {
    setEditing(expense);
    reset({
      description: expense.description,
      amount: Number(expense.amount),
      category: expense.category as ExpenseForm['category'],
      status: expense.status as ExpenseForm['status'],
      expenseDate: expense.expenseDate ? expense.expenseDate.split('T')[0] : '',
      projectId: expense.projectId || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const onSubmit = (form: ExpenseForm) => {
    if (editing) updateMutation.mutate({ id: editing.id, body: form });
    else createMutation.mutate(form);
  };

  return (
    <div>
      <PageHeader title="Expenses" description="Track and approve project expenses" />

      <ListToolbar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search description or project..."
        filters={[
          {
            key: 'category',
            label: 'All categories',
            value: list.filters.category || '',
            onChange: (v) => list.setFilter('category', v),
            options: EXPENSE_CATEGORIES.map((c) => ({ label: c, value: c })),
          },
          {
            key: 'status',
            label: 'All statuses',
            value: list.filters.status || '',
            onChange: (v) => list.setFilter('status', v),
            options: EXPENSE_STATUSES.map((s) => ({ label: s, value: s })),
          },
        ]}
        action={
          <button className="btn-gold" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Expense
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
                      {e.creator && (
                        <p className="text-xs text-luxury-slate">
                          {e.creator.firstName} {e.creator.lastName}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-luxury-slate">{e.category}</td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(Number(e.amount))}</td>
                    <td className="px-4 py-3 text-luxury-slate">{e.project?.name || '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[e.status] || 'bg-gray-50'}`}
                      >
                        {e.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-luxury-slate">{formatDate(e.expenseDate)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {(e.status === 'PENDING' || e.status === 'DRAFT') && (
                          <button className="btn-gold !px-2 !py-1.5" onClick={() => setApproveId(e.id)} title="Approve">
                            <CheckCircle className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button className="btn-outline !px-2 !py-1.5" onClick={() => openEdit(e)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button className="btn-danger !px-2 !py-1.5" onClick={() => setDeleteId(e.id)}>
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Expense' : 'Add Expense'} className="max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <input {...register('description')} className="luxury-input" placeholder="e.g. Cement supply for Phase 1" />
            {errors.description && <p className="text-xs text-red-600 mt-1">{errors.description.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Amount</label>
              <input {...register('amount')} type="number" step="0.01" className="luxury-input" />
              {errors.amount && <p className="text-xs text-red-600 mt-1">{errors.amount.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select {...register('category')} className="luxury-input">
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select {...register('status')} className="luxury-input">
                {EXPENSE_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <input {...register('expenseDate')} type="date" className="luxury-input" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Project</label>
              <select {...register('projectId')} className="luxury-input">
                <option value="">No project</option>
                {projects?.items.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </select>
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

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Delete Expense"
        message="Are you sure you want to delete this expense?"
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMutation.isPending}
      />

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
