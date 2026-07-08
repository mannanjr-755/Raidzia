'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { api, type PaginatedResponse } from '@/lib/api';
import { PageHeader, LoadingSpinner, EmptyState } from '@/components/ui/stat-card';
import { Modal, ConfirmDialog } from '@/components/ui/modal';
import { invalidateAfterMutation } from '@/lib/invalidate-dashboard';
import { formatDate } from '@/lib/utils';

interface ProjectOption {
  id: string;
  name: string;
  code: string;
}

interface Inspection {
  id: string;
  title: string;
  type: string;
  status: string;
  date: string;
  notes?: string;
  project?: { name: string; code: string };
}

export default function InspectionPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['inspections'],
    queryFn: () => api.get<Inspection[]>('/inspection'),
  });

  const { data: projects } = useQuery({
    queryKey: ['projects-options'],
    queryFn: () => api.get<PaginatedResponse<ProjectOption>>('/projects?limit=100'),
  });

  const form = useForm({
    defaultValues: { projectId: '', title: '', type: 'QUALITY', notes: '' },
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Inspection>('/inspection', body),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['inspections']);
      toast.success('Inspection created');
      setModalOpen(false);
      form.reset({ type: 'QUALITY' });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/inspection/${id}`),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['inspections']);
      toast.success('Inspection deleted');
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Inspection"
        description="Quality inspections and site audits"
        action={
          <button className="btn-gold" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> New Inspection
          </button>
        }
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : !data?.length ? (
        <EmptyState message="No inspections found." />
      ) : (
        <div className="luxury-card divide-y divide-luxury-border">
          {data.map((item) => (
            <div key={item.id} className="p-4 flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-luxury-slate">{item.project?.name || 'Unknown project'} · {item.type}</p>
                <p className="text-xs text-luxury-slate mt-1">{formatDate(item.date)} · {item.status}</p>
              </div>
              <button className="btn-danger !px-2 !py-1.5" onClick={() => setDeleteId(item.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Inspection">
        <form onSubmit={form.handleSubmit((values) => createMutation.mutate(values))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Project</label>
            <select {...form.register('projectId', { required: true })} className="luxury-input">
              <option value="">Select project</option>
              {projects?.items.map((project) => (
                <option key={project.id} value={project.id}>{project.code} — {project.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input {...form.register('title', { required: true })} className="luxury-input" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <input {...form.register('type')} className="luxury-input" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea {...form.register('notes')} className="luxury-input min-h-[80px]" />
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
        title="Delete Inspection"
        message="Are you sure you want to delete this inspection?"
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
