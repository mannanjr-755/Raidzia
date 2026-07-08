'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { api, type PaginatedResponse } from '@/lib/api';
import { invalidateAfterMutation } from '@/lib/invalidate-dashboard';
import { formatCurrency } from '@/lib/utils';
import { PageHeader, LoadingSpinner, EmptyState } from '@/components/ui/stat-card';
import { Modal, ConfirmDialog } from '@/components/ui/modal';

interface Project {
  id: string;
  code: string;
  name: string;
  description?: string;
  location: string;
  city?: string;
  clientName?: string;
  status: string;
  budget: number | string;
  estimatedCost: number | string;
  completionPct: number | string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  manager?: { firstName: string; lastName: string };
  landParcel?: { title: string };
}

const projectSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  location: z.string().min(1, 'Location is required'),
  city: z.string().optional(),
  clientName: z.string().optional(),
  status: z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
  budget: z.coerce.number().min(0),
  estimatedCost: z.coerce.number().min(0),
  completionPct: z.coerce.number().min(0).max(100),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

type ProjectForm = z.infer<typeof projectSchema>;

const statusColors: Record<string, string> = {
  PLANNING: 'bg-blue-50 text-blue-700',
  ACTIVE: 'bg-green-50 text-green-700',
  ON_HOLD: 'bg-yellow-50 text-yellow-700',
  COMPLETED: 'bg-gold-50 text-gold-700',
  CANCELLED: 'bg-red-50 text-red-700',
};

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['projects', search],
    queryFn: () =>
      api.get<PaginatedResponse<Project>>(`/projects?search=${encodeURIComponent(search)}&limit=50`),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProjectForm>({
    resolver: zodResolver(projectSchema),
    defaultValues: { status: 'PLANNING', budget: 0, estimatedCost: 0, completionPct: 0 },
  });

  const createMutation = useMutation({
    mutationFn: (body: ProjectForm) => api.post<Project>('/projects', body),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['projects']);
      toast.success('Project created');
      closeModal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ProjectForm }) =>
      api.put<Project>(`/projects/${id}`, body),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['projects']);
      toast.success('Project updated');
      closeModal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${id}`),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['projects']);
      toast.success('Project deleted');
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = async () => {
    setEditing(null);
    try {
      const next = await api.get<{ code: string }>('/projects/next-code');
      reset({ code: next.code, status: 'PLANNING', budget: 0, estimatedCost: 0, completionPct: 0 });
    } catch {
      reset({ code: '', status: 'PLANNING', budget: 0, estimatedCost: 0, completionPct: 0 });
    }
    setModalOpen(true);
  };

  const openEdit = (project: Project) => {
    setEditing(project);
    reset({
      code: project.code,
      name: project.name,
      description: project.description || '',
      location: project.location,
      city: project.city || '',
      clientName: project.clientName || '',
      status: project.status as ProjectForm['status'],
      budget: Number(project.budget),
      estimatedCost: Number(project.estimatedCost),
      completionPct: Number(project.completionPct),
      startDate: project.startDate ? project.startDate.split('T')[0] : '',
      endDate: project.endDate ? project.endDate.split('T')[0] : '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const onSubmit = (form: ProjectForm) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, body: form });
    } else {
      createMutation.mutate(form);
    }
  };

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Manage construction projects"
        action={
          <button className="btn-gold" onClick={openCreate}>
            <Plus className="h-4 w-4" /> New Project
          </button>
        }
      />

      <div className="mb-6 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-luxury-slate" />
        <input
          className="luxury-input pl-10"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : !data?.items.length ? (
        <EmptyState message="No projects found. Create your first project." />
      ) : (
        <div className="luxury-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-luxury-border bg-luxury-cream">
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Code</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Location</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Budget</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Progress</th>
                  <th className="px-4 py-3 text-right font-medium text-luxury-slate">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id} className="border-b border-luxury-border hover:bg-luxury-cream/50">
                    <td className="px-4 py-3 font-medium">{p.code}</td>
                    <td className="px-4 py-3">{p.name}</td>
                    <td className="px-4 py-3 text-luxury-slate">{p.location}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[p.status] || 'bg-gray-50'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{formatCurrency(Number(p.budget))}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 rounded-full bg-luxury-cream overflow-hidden">
                          <div
                            className="h-full bg-gold rounded-full"
                            style={{ width: `${Number(p.completionPct)}%` }}
                          />
                        </div>
                        <span className="text-xs">{Number(p.completionPct)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button className="btn-outline !px-2 !py-1.5" onClick={() => openEdit(p)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button className="btn-danger !px-2 !py-1.5" onClick={() => setDeleteId(p.id)}>
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

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Project' : 'New Project'}
        className="max-w-2xl"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Code</label>
              <input {...register('code')} className="luxury-input" placeholder="Auto-generated if left blank" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input {...register('name')} className="luxury-input" />
              {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Location</label>
              <input {...register('location')} className="luxury-input" />
              {errors.location && <p className="text-xs text-red-600 mt-1">{errors.location.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">City</label>
              <input {...register('city')} className="luxury-input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Client</label>
              <input {...register('clientName')} className="luxury-input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select {...register('status')} className="luxury-input">
                {['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Budget</label>
              <input {...register('budget')} type="number" className="luxury-input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Estimated Cost</label>
              <input {...register('estimatedCost')} type="number" className="luxury-input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Completion %</label>
              <input {...register('completionPct')} type="number" className="luxury-input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <input {...register('startDate')} type="date" className="luxury-input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Date</label>
              <input {...register('endDate')} type="date" className="luxury-input" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea {...register('description')} className="luxury-input min-h-[80px]" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-outline" onClick={closeModal}>Cancel</button>
            <button
              type="submit"
              className="btn-gold"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Delete Project"
        message="Are you sure you want to delete this project? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
