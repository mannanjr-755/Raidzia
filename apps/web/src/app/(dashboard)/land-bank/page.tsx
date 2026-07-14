'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import { api, type PaginatedResponse } from '@/lib/api';
import { invalidateAfterMutation } from '@/lib/invalidate-dashboard';
import { formatCurrency } from '@/lib/utils';
import { PageHeader, LoadingSpinner, EmptyState } from '@/components/ui/stat-card';
import { Modal, ConfirmDialog } from '@/components/ui/modal';
import { ListToolbar, PaginationBar } from '@/components/ui/list-controls';
import { useListParams } from '@/hooks/use-list-params';

interface LandParcel {
  id: string;
  landId: string;
  title: string;
  location: string;
  areaSqYards: number | string;
  areaSqFeet: number | string;
  landType?: string;
  status: string;
  purchasePrice?: number | string;
  marketPrice?: number | string;
  ownerName?: string;
  notes?: string;
}

const LAND_TYPES = ['RESIDENTIAL', 'COMMERCIAL', 'MIXED_USE', 'INDUSTRIAL', 'AGRICULTURAL'] as const;
const LAND_STATUSES = ['RESEARCH', 'NEGOTIATION', 'DUE_DILIGENCE', 'APPROVED', 'PURCHASED', 'REJECTED'] as const;

const landSchema = z.object({
  landId: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  location: z.string().min(1, 'Location is required'),
  areaSqYards: z.coerce.number().positive('Area is required'),
  areaSqFeet: z.coerce.number().positive('Area is required'),
  landType: z.enum(LAND_TYPES).optional(),
  status: z.enum(LAND_STATUSES).optional(),
  purchasePrice: z.coerce.number().optional(),
  marketPrice: z.coerce.number().optional(),
  ownerName: z.string().optional(),
  notes: z.string().optional(),
});

type LandForm = z.infer<typeof landSchema>;

interface FeasibilityResult {
  calculations: {
    totalInvestment: number;
    totalRevenue: number;
    netProfit: number;
    roi: number;
    costPerSqFt: number;
  };
  title: string;
}

const statusColors: Record<string, string> = {
  RESEARCH: 'bg-blue-50 text-blue-700',
  NEGOTIATION: 'bg-yellow-50 text-yellow-700',
  DUE_DILIGENCE: 'bg-purple-50 text-purple-700',
  APPROVED: 'bg-green-50 text-green-700',
  PURCHASED: 'bg-gold-50 text-gold-700',
  REJECTED: 'bg-red-50 text-red-700',
};

export default function LandBankPage() {
  const queryClient = useQueryClient();
  const list = useListParams(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LandParcel | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [feasibilityId, setFeasibilityId] = useState<string | null>(null);
  const [feasibilityResult, setFeasibilityResult] = useState<FeasibilityResult | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['land', list.queryString],
    queryFn: () => api.get<PaginatedResponse<LandParcel>>(`/land?${list.queryString}`),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LandForm>({
    resolver: zodResolver(landSchema),
    defaultValues: { landType: 'RESIDENTIAL', status: 'RESEARCH' },
  });

  const createMutation = useMutation({
    mutationFn: (body: LandForm) => api.post<LandParcel>('/land', body),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['land']);
      toast.success('Land parcel created');
      closeModal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: LandForm }) => api.put<LandParcel>(`/land/${id}`, body),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['land']);
      toast.success('Land parcel updated');
      closeModal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/land/${id}`),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['land']);
      toast.success('Land parcel deleted');
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const feasibilityMutation = useMutation({
    mutationFn: (id: string) => api.post<FeasibilityResult>(`/land/${id}/feasibility`, {}),
    onSuccess: (result) => {
      setFeasibilityResult(result);
      toast.success('Feasibility study completed');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = async () => {
    setEditing(null);
    try {
      const next = await api.get<{ landId: string }>('/land/next-id');
      reset({ landId: next.landId, landType: 'RESIDENTIAL', status: 'RESEARCH' });
    } catch {
      reset({ landType: 'RESIDENTIAL', status: 'RESEARCH' });
    }
    setModalOpen(true);
  };

  const openEdit = (land: LandParcel) => {
    setEditing(land);
    reset({
      landId: land.landId,
      title: land.title,
      location: land.location,
      areaSqYards: Number(land.areaSqYards),
      areaSqFeet: Number(land.areaSqFeet),
      landType: land.landType as LandForm['landType'],
      status: land.status as LandForm['status'],
      purchasePrice: land.purchasePrice ? Number(land.purchasePrice) : undefined,
      marketPrice: land.marketPrice ? Number(land.marketPrice) : undefined,
      ownerName: land.ownerName || '',
      notes: land.notes || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const onSubmit = (form: LandForm) => {
    if (editing) updateMutation.mutate({ id: editing.id, body: form });
    else createMutation.mutate(form);
  };

  return (
    <div>
      <PageHeader title="Land Bank" description="Manage land parcels and feasibility studies" />

      <ListToolbar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search by ID, title, or location..."
        filters={[
          {
            key: 'status',
            label: 'All statuses',
            value: list.filters.status || '',
            onChange: (v) => list.setFilter('status', v),
            options: LAND_STATUSES.map((s) => ({ label: s, value: s })),
          },
          {
            key: 'landType',
            label: 'All types',
            value: list.filters.landType || '',
            onChange: (v) => list.setFilter('landType', v),
            options: LAND_TYPES.map((t) => ({ label: t, value: t })),
          },
        ]}
        action={
          <button className="btn-gold" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Land
          </button>
        }
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : !data?.items.length ? (
        <EmptyState message="No land parcels found." />
      ) : (
        <div className="grid gap-4">
          {data.items.map((land) => (
            <div key={land.id} className="luxury-card p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-mono text-xs text-gold">{land.landId}</span>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[land.status] || 'bg-gray-50'}`}
                    >
                      {land.status}
                    </span>
                    {land.landType && (
                      <span className="rounded-full bg-luxury-cream px-2 py-0.5 text-xs text-luxury-slate">
                        {land.landType}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-luxury-charcoal">{land.title}</h3>
                  <p className="text-sm text-luxury-slate">{land.location}</p>
                  <div className="mt-2 flex flex-wrap gap-4 text-sm text-luxury-slate">
                    <span>{Number(land.areaSqYards).toLocaleString()} sq yd</span>
                    <span>{Number(land.areaSqFeet).toLocaleString()} sq ft</span>
                    {land.purchasePrice != null && Number(land.purchasePrice) > 0 && (
                      <span>Price: {formatCurrency(Number(land.purchasePrice))}</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    className="btn-gold"
                    onClick={() => {
                      setFeasibilityId(land.id);
                      setFeasibilityResult(null);
                      feasibilityMutation.mutate(land.id);
                    }}
                    disabled={feasibilityMutation.isPending && feasibilityId === land.id}
                  >
                    <Calculator className="h-4 w-4" />
                    {feasibilityMutation.isPending && feasibilityId === land.id ? 'Running...' : 'Run Feasibility'}
                  </button>
                  <button className="btn-outline !px-2" onClick={() => openEdit(land)}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button className="btn-danger !px-2" onClick={() => setDeleteId(land.id)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {feasibilityResult && feasibilityId === land.id && (
                <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-gold-100 bg-gold-50 p-4 text-sm sm:grid-cols-5">
                  <div>
                    <p className="text-luxury-slate">Total Investment</p>
                    <p className="font-semibold">{formatCurrency(feasibilityResult.calculations.totalInvestment)}</p>
                  </div>
                  <div>
                    <p className="text-luxury-slate">Revenue</p>
                    <p className="font-semibold">{formatCurrency(feasibilityResult.calculations.totalRevenue)}</p>
                  </div>
                  <div>
                    <p className="text-luxury-slate">Net Profit</p>
                    <p className="font-semibold text-green-700">
                      {formatCurrency(feasibilityResult.calculations.netProfit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-luxury-slate">ROI</p>
                    <p className="font-semibold">{feasibilityResult.calculations.roi.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-luxury-slate">Cost/sqft</p>
                    <p className="font-semibold">
                      {formatCurrency(feasibilityResult.calculations.costPerSqFt)}/sqft
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Land' : 'Add Land'} className="max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Land ID</label>
              <input {...register('landId')} className="luxury-input" placeholder="Auto-generated if left blank" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Title</label>
              <input {...register('title')} className="luxury-input" />
              {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium">Location</label>
              <input {...register('location')} className="luxury-input" />
              {errors.location && <p className="mt-1 text-xs text-red-600">{errors.location.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Area (Sq Yards)</label>
              <input {...register('areaSqYards')} type="number" className="luxury-input" />
              {errors.areaSqYards && <p className="mt-1 text-xs text-red-600">{errors.areaSqYards.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Area (Sq Feet)</label>
              <input {...register('areaSqFeet')} type="number" className="luxury-input" />
              {errors.areaSqFeet && <p className="mt-1 text-xs text-red-600">{errors.areaSqFeet.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Type</label>
              <select {...register('landType')} className="luxury-input">
                {LAND_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Status</label>
              <select {...register('status')} className="luxury-input">
                {LAND_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Purchase Price</label>
              <input {...register('purchasePrice')} type="number" className="luxury-input" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Market Price</label>
              <input {...register('marketPrice')} type="number" className="luxury-input" />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium">Owner Name</label>
              <input {...register('ownerName')} className="luxury-input" />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium">Notes</label>
              <textarea {...register('notes')} className="luxury-input min-h-[60px]" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-outline" onClick={closeModal}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-gold"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : editing
                  ? 'Update'
                  : 'Add'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Delete Land Parcel"
        message="Are you sure you want to delete this land parcel?"
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
