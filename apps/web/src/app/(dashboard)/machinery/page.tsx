'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { PageHeader, LoadingSpinner, EmptyState } from '@/components/ui/stat-card';
import { Modal, ConfirmDialog } from '@/components/ui/modal';
import { invalidateAfterMutation } from '@/lib/invalidate-dashboard';

interface Machinery {
  id: string;
  name: string;
  type: string;
  status: string;
  registrationNo?: string;
  operatorName?: string;
}

export default function MachineryPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['machinery'],
    queryFn: () => api.get<Machinery[]>('/machinery'),
  });

  const form = useForm({
    defaultValues: { name: '', type: '', registrationNo: '', operatorName: '', status: 'OPERATIONAL' },
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Machinery>('/machinery', body),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['machinery']);
      toast.success('Machinery added');
      setModalOpen(false);
      form.reset({ status: 'OPERATIONAL' });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/machinery/${id}`),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['machinery']);
      toast.success('Machinery removed');
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Machinery"
        description="Equipment and machinery fleet management"
        action={
          <button className="btn-gold" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Add Machinery
          </button>
        }
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : !data?.length ? (
        <EmptyState message="No machinery found." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((item) => (
            <div key={item.id} className="luxury-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{item.name}</h3>
                  <p className="text-sm text-luxury-slate">{item.type}</p>
                  <p className="text-xs text-gold mt-1">{item.status}</p>
                </div>
                <button className="btn-danger !px-2 !py-1.5" onClick={() => setDeleteId(item.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {item.operatorName && <p className="text-xs text-luxury-slate mt-3">Operator: {item.operatorName}</p>}
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Machinery">
        <form onSubmit={form.handleSubmit((values) => createMutation.mutate(values))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input {...form.register('name', { required: true })} className="luxury-input" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <input {...form.register('type', { required: true })} className="luxury-input" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Registration No</label>
            <input {...form.register('registrationNo')} className="luxury-input" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Operator</label>
            <input {...form.register('operatorName')} className="luxury-input" />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-gold" disabled={createMutation.isPending}>Create</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Remove Machinery"
        message="Are you sure you want to remove this machinery record?"
        confirmLabel="Remove"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
