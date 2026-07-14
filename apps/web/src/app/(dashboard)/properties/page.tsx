'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, type PaginatedResponse } from '@/lib/api';
import { invalidateAfterMutation } from '@/lib/invalidate-dashboard';
import { formatCurrency } from '@/lib/utils';
import { PageHeader, LoadingSpinner, EmptyState } from '@/components/ui/stat-card';
import { Modal, ConfirmDialog } from '@/components/ui/modal';
import { ListToolbar, PaginationBar } from '@/components/ui/list-controls';
import { useListParams } from '@/hooks/use-list-params';

interface ProjectOption {
  id: string;
  name: string;
  code: string;
}

interface Building {
  id: string;
  name: string;
  tower?: string;
  projectId: string;
  totalFloors: number;
  floors?: Floor[];
}

interface Floor {
  id: string;
  number: number;
  name: string;
  buildingId: string;
}

interface Unit {
  id: string;
  unitNumber: string;
  unitType: string;
  area: number | string;
  price: number | string;
  status: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  description?: string | null;
  floorId: string;
  floor?: {
    id: string;
    name: string;
    number: number;
    building?: {
      id: string;
      name: string;
      projectId: string;
      project?: { id: string; name: string; code: string };
    };
  };
}

const UNIT_TYPES = ['APARTMENT', 'SHOP', 'OFFICE', 'WAREHOUSE', 'PLOT', 'PENTHOUSE'] as const;
const UNIT_STATUSES = [
  'AVAILABLE',
  'RESERVED',
  'BOOKED',
  'SOLD',
  'TRANSFERRED',
  'UNDER_CONSTRUCTION',
] as const;

const unitSchema = z.object({
  floorId: z.string().min(1, 'Floor is required'),
  unitNumber: z.string().min(1, 'Unit number is required'),
  unitType: z.enum(UNIT_TYPES).optional(),
  area: z.coerce.number().positive('Area is required'),
  price: z.coerce.number().min(0, 'Price is required'),
  status: z.enum(UNIT_STATUSES).optional(),
  bedrooms: z.coerce.number().optional(),
  bathrooms: z.coerce.number().optional(),
  description: z.string().optional(),
});

const buildingSchema = z.object({
  projectId: z.string().min(1, 'Project is required'),
  name: z.string().min(1, 'Name is required'),
  tower: z.string().optional(),
  totalFloors: z.coerce.number().min(1, 'At least 1 floor'),
});

type UnitForm = z.infer<typeof unitSchema>;
type BuildingForm = z.infer<typeof buildingSchema>;

const statusColors: Record<string, string> = {
  AVAILABLE: 'bg-green-50 text-green-700',
  RESERVED: 'bg-yellow-50 text-yellow-700',
  BOOKED: 'bg-blue-50 text-blue-700',
  SOLD: 'bg-gold-50 text-gold-700',
  TRANSFERRED: 'bg-purple-50 text-purple-700',
  UNDER_CONSTRUCTION: 'bg-orange-50 text-orange-700',
};

export default function PropertiesPage() {
  const queryClient = useQueryClient();
  const list = useListParams(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [buildingModalOpen, setBuildingModalOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['units', list.queryString],
    queryFn: () => api.get<PaginatedResponse<Unit>>(`/properties/units?${list.queryString}`),
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects-dropdown'],
    queryFn: () => api.get<PaginatedResponse<ProjectOption>>('/projects?limit=100'),
  });

  const { data: buildingsData } = useQuery({
    queryKey: ['buildings-dropdown'],
    queryFn: () => api.get<PaginatedResponse<Building>>('/properties/buildings?limit=100'),
  });

  const { data: floors = [] } = useQuery({
    queryKey: ['floors', selectedBuildingId],
    queryFn: () => api.get<Floor[]>(`/properties/floors?buildingId=${selectedBuildingId}`),
    enabled: !!selectedBuildingId,
  });

  const unitForm = useForm<UnitForm>({
    resolver: zodResolver(unitSchema),
    defaultValues: { unitType: 'APARTMENT', status: 'AVAILABLE', area: 0, price: 0 },
  });

  const buildingForm = useForm<BuildingForm>({
    resolver: zodResolver(buildingSchema),
    defaultValues: { totalFloors: 1 },
  });

  useEffect(() => {
    if (!selectedBuildingId) unitForm.setValue('floorId', '');
  }, [selectedBuildingId, unitForm]);

  const createMutation = useMutation({
    mutationFn: (body: UnitForm) => api.post<Unit>('/properties/units', body),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['units']);
      toast.success('Unit created');
      closeModal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UnitForm }) =>
      api.put<Unit>(`/properties/units/${id}`, body),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['units']);
      toast.success('Unit updated');
      closeModal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/properties/units/${id}`),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['units']);
      toast.success('Unit deleted');
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createBuildingMutation = useMutation({
    mutationFn: (body: BuildingForm) => api.post<Building>('/properties/buildings', body),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['buildings', 'floors']);
      toast.success('Building created with floors');
      setBuildingModalOpen(false);
      buildingForm.reset({ totalFloors: 1 });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditing(null);
    setSelectedBuildingId('');
    unitForm.reset({ unitType: 'APARTMENT', status: 'AVAILABLE', area: 0, price: 0, floorId: '' });
    setModalOpen(true);
  };

  const openEdit = (unit: Unit) => {
    setEditing(unit);
    const buildingId = unit.floor?.building?.id || '';
    setSelectedBuildingId(buildingId);
    unitForm.reset({
      floorId: unit.floorId,
      unitNumber: unit.unitNumber,
      unitType: unit.unitType as UnitForm['unitType'],
      area: Number(unit.area),
      price: Number(unit.price),
      status: unit.status as UnitForm['status'],
      bedrooms: unit.bedrooms ?? undefined,
      bathrooms: unit.bathrooms ?? undefined,
      description: unit.description || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setSelectedBuildingId('');
  };

  const onSubmit = (form: UnitForm) => {
    if (editing) updateMutation.mutate({ id: editing.id, body: form });
    else createMutation.mutate(form);
  };

  const projects = projectsData?.items || [];
  const buildings = buildingsData?.items || [];

  return (
    <div>
      <PageHeader title="Properties" description="Manage units, buildings, and inventory" />

      <ListToolbar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search by unit number..."
        filters={[
          {
            key: 'status',
            label: 'All statuses',
            value: list.filters.status || '',
            onChange: (v) => list.setFilter('status', v),
            options: UNIT_STATUSES.map((s) => ({ label: s, value: s })),
          },
          {
            key: 'projectId',
            label: 'All projects',
            value: list.filters.projectId || '',
            onChange: (v) => list.setFilter('projectId', v),
            options: projects.map((p) => ({ label: `${p.code} — ${p.name}`, value: p.id })),
          },
        ]}
        action={
          <div className="flex gap-2">
            <button className="btn-outline" onClick={() => setBuildingModalOpen(true)}>
              <Building2 className="h-4 w-4" /> Add Building
            </button>
            <button className="btn-gold" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add Unit
            </button>
          </div>
        }
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : !data?.items.length ? (
        <EmptyState message="No units found." />
      ) : (
        <div className="luxury-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-luxury-border bg-luxury-cream">
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Unit</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Project</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Building / Floor</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Area</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Price</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-luxury-slate">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((unit) => (
                  <tr key={unit.id} className="border-b border-luxury-border hover:bg-luxury-cream/50">
                    <td className="px-4 py-3 font-medium">{unit.unitNumber}</td>
                    <td className="px-4 py-3 text-luxury-slate">
                      {unit.floor?.building?.project?.name || '—'}
                    </td>
                    <td className="px-4 py-3 text-luxury-slate">
                      {unit.floor?.building?.name || '—'}
                      {unit.floor?.name ? ` / ${unit.floor.name}` : ''}
                    </td>
                    <td className="px-4 py-3">{unit.unitType}</td>
                    <td className="px-4 py-3">{Number(unit.area).toLocaleString()} sq ft</td>
                    <td className="px-4 py-3">{formatCurrency(Number(unit.price))}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[unit.status] || 'bg-gray-50'}`}
                      >
                        {unit.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button className="btn-outline !px-2 !py-1.5" onClick={() => openEdit(unit)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button className="btn-danger !px-2 !py-1.5" onClick={() => setDeleteId(unit.id)}>
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Unit' : 'Add Unit'} className="max-w-2xl">
        <form onSubmit={unitForm.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Building</label>
              <select
                className="luxury-input"
                value={selectedBuildingId}
                onChange={(e) => {
                  setSelectedBuildingId(e.target.value);
                  unitForm.setValue('floorId', '');
                }}
              >
                <option value="">Select building</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.tower ? ` (${b.tower})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Floor</label>
              <select {...unitForm.register('floorId')} className="luxury-input" disabled={!selectedBuildingId}>
                <option value="">Select floor</option>
                {floors.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name || `Floor ${f.number}`}
                  </option>
                ))}
              </select>
              {unitForm.formState.errors.floorId && (
                <p className="mt-1 text-xs text-red-600">{unitForm.formState.errors.floorId.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Unit Number</label>
              <input {...unitForm.register('unitNumber')} className="luxury-input" />
              {unitForm.formState.errors.unitNumber && (
                <p className="mt-1 text-xs text-red-600">{unitForm.formState.errors.unitNumber.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Type</label>
              <select {...unitForm.register('unitType')} className="luxury-input">
                {UNIT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Area (sq ft)</label>
              <input {...unitForm.register('area')} type="number" className="luxury-input" />
              {unitForm.formState.errors.area && (
                <p className="mt-1 text-xs text-red-600">{unitForm.formState.errors.area.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Price</label>
              <input {...unitForm.register('price')} type="number" className="luxury-input" />
              {unitForm.formState.errors.price && (
                <p className="mt-1 text-xs text-red-600">{unitForm.formState.errors.price.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Status</label>
              <select {...unitForm.register('status')} className="luxury-input">
                {UNIT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Bedrooms</label>
              <input {...unitForm.register('bedrooms')} type="number" className="luxury-input" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Bathrooms</label>
              <input {...unitForm.register('bathrooms')} type="number" className="luxury-input" />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium">Description</label>
              <textarea {...unitForm.register('description')} className="luxury-input min-h-[60px]" />
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

      <Modal
        open={buildingModalOpen}
        onClose={() => setBuildingModalOpen(false)}
        title="Add Building"
        className="max-w-lg"
      >
        <form
          onSubmit={buildingForm.handleSubmit((form) => createBuildingMutation.mutate(form))}
          className="space-y-4"
        >
          <div>
            <label className="mb-1 block text-sm font-medium">Project</label>
            <select {...buildingForm.register('projectId')} className="luxury-input">
              <option value="">Select project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
            {buildingForm.formState.errors.projectId && (
              <p className="mt-1 text-xs text-red-600">{buildingForm.formState.errors.projectId.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Building Name</label>
            <input {...buildingForm.register('name')} className="luxury-input" />
            {buildingForm.formState.errors.name && (
              <p className="mt-1 text-xs text-red-600">{buildingForm.formState.errors.name.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Tower (optional)</label>
            <input {...buildingForm.register('tower')} className="luxury-input" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Total Floors</label>
            <input {...buildingForm.register('totalFloors')} type="number" className="luxury-input" />
            {buildingForm.formState.errors.totalFloors && (
              <p className="mt-1 text-xs text-red-600">{buildingForm.formState.errors.totalFloors.message}</p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-outline" onClick={() => setBuildingModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-gold" disabled={createBuildingMutation.isPending}>
              {createBuildingMutation.isPending ? 'Creating...' : 'Create Building'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Delete Unit"
        message="Are you sure you want to delete this unit?"
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
