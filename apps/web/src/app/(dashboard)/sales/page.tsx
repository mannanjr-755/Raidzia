'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api, type PaginatedResponse } from '@/lib/api';
import { invalidateAfterMutation } from '@/lib/invalidate-dashboard';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PageHeader, LoadingSpinner, EmptyState } from '@/components/ui/stat-card';
import { Modal, ConfirmDialog } from '@/components/ui/modal';
import { ListToolbar, PaginationBar } from '@/components/ui/list-controls';
import { useListParams } from '@/hooks/use-list-params';

interface CustomerOption {
  id: string;
  name: string;
  phone?: string;
}

interface UnitOption {
  id: string;
  unitNumber: string;
  price: number | string;
  status: string;
  floor?: {
    building?: {
      name: string;
      project?: { name: string };
    };
  };
}

interface Booking {
  id: string;
  bookingNumber: string;
  status: string;
  totalAmount: number | string;
  downPayment: number | string;
  discount?: number | string;
  notes?: string | null;
  possessionDate?: string | null;
  createdAt: string;
  customerId: string;
  unitId: string;
  customer: { id: string; name: string; phone?: string };
  unit?: {
    id: string;
    unitNumber: string;
    price?: number | string;
    floor?: { building?: { name: string; project?: { name: string } } };
  };
}

const BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'] as const;

const bookingSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  unitId: z.string().min(1, 'Unit is required'),
  totalAmount: z.coerce.number().positive('Total amount is required'),
  downPayment: z.coerce.number().min(0).optional(),
  discount: z.coerce.number().min(0).optional(),
  status: z.enum(BOOKING_STATUSES).optional(),
  notes: z.string().optional(),
  possessionDate: z.string().optional(),
});

type BookingForm = z.infer<typeof bookingSchema>;

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-50 text-yellow-700',
  CONFIRMED: 'bg-green-50 text-green-700',
  CANCELLED: 'bg-red-50 text-red-700',
  COMPLETED: 'bg-gold-50 text-gold-700',
};

export default function SalesPage() {
  const queryClient = useQueryClient();
  const list = useListParams(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['bookings', list.queryString],
    queryFn: () => api.get<PaginatedResponse<Booking>>(`/crm/bookings?${list.queryString}`),
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers-dropdown'],
    queryFn: () => api.get<PaginatedResponse<CustomerOption>>('/crm/customers?limit=100'),
  });

  const { data: unitsData } = useQuery({
    queryKey: ['available-units-dropdown'],
    queryFn: () =>
      api.get<PaginatedResponse<UnitOption>>('/properties/units?status=AVAILABLE&limit=100'),
    enabled: modalOpen,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BookingForm>({
    resolver: zodResolver(bookingSchema),
    defaultValues: { status: 'PENDING', downPayment: 0, discount: 0 },
  });

  const selectedUnitId = watch('unitId');

  const createMutation = useMutation({
    mutationFn: (body: BookingForm) => api.post<Booking>('/crm/bookings', body),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['bookings', 'units']);
      toast.success('Booking created');
      closeModal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: BookingForm }) =>
      api.put<Booking>(`/crm/bookings/${id}`, body),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['bookings', 'units']);
      toast.success('Booking updated');
      closeModal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/crm/bookings/${id}`),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['bookings', 'units']);
      toast.success('Booking deleted');
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => api.post<Booking>(`/crm/bookings/${id}/confirm`),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['bookings', 'units']);
      toast.success('Booking confirmed successfully');
      setConfirmId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditing(null);
    reset({ status: 'PENDING', downPayment: 0, discount: 0, customerId: '', unitId: '', totalAmount: 0 });
    setModalOpen(true);
  };

  const openEdit = (booking: Booking) => {
    setEditing(booking);
    reset({
      customerId: booking.customerId || booking.customer?.id,
      unitId: booking.unitId || booking.unit?.id || '',
      totalAmount: Number(booking.totalAmount),
      downPayment: Number(booking.downPayment || 0),
      discount: Number(booking.discount || 0),
      status: booking.status as BookingForm['status'],
      notes: booking.notes || '',
      possessionDate: booking.possessionDate ? booking.possessionDate.split('T')[0] : '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const onSubmit = (form: BookingForm) => {
    if (editing) updateMutation.mutate({ id: editing.id, body: form });
    else createMutation.mutate(form);
  };

  const customers = customersData?.items || [];
  const availableUnits = unitsData?.items || [];

  // When editing, ensure current unit appears in dropdown even if not AVAILABLE
  const unitOptions: UnitOption[] =
    editing?.unit && !availableUnits.some((u) => u.id === editing.unitId)
      ? [
          {
            id: editing.unit.id,
            unitNumber: editing.unit.unitNumber,
            price: editing.unit.price ?? editing.totalAmount,
            status: 'CURRENT',
            floor: editing.unit.floor,
          },
          ...availableUnits,
        ]
      : availableUnits;

  return (
    <div>
      <PageHeader title="Sales" description="Manage property bookings and confirmations" />

      <ListToolbar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search by booking # or customer..."
        filters={[
          {
            key: 'status',
            label: 'All statuses',
            value: list.filters.status || '',
            onChange: (v) => list.setFilter('status', v),
            options: BOOKING_STATUSES.map((s) => ({ label: s, value: s })),
          },
        ]}
        action={
          <button className="btn-gold" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Booking
          </button>
        }
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : !data?.items.length ? (
        <EmptyState message="No bookings found." />
      ) : (
        <div className="luxury-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-luxury-border bg-luxury-cream">
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Booking #</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Customer</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Unit</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Down Payment</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Date</th>
                  <th className="px-4 py-3 text-right font-medium text-luxury-slate">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((b) => (
                  <tr key={b.id} className="border-b border-luxury-border hover:bg-luxury-cream/50">
                    <td className="px-4 py-3 font-mono text-gold-700">{b.bookingNumber}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{b.customer.name}</p>
                      {b.customer.phone && <p className="text-xs text-luxury-slate">{b.customer.phone}</p>}
                    </td>
                    <td className="px-4 py-3 text-luxury-slate">
                      {b.unit?.unitNumber || '—'}
                      {b.unit?.floor?.building?.project?.name && (
                        <p className="text-xs">{b.unit.floor.building.project.name}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(Number(b.totalAmount))}</td>
                    <td className="px-4 py-3">{formatCurrency(Number(b.downPayment))}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[b.status] || 'bg-gray-50'}`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-luxury-slate">{formatDate(b.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {b.status === 'PENDING' && (
                          <button className="btn-gold !px-2 !py-1.5" onClick={() => setConfirmId(b.id)}>
                            <CheckCircle className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button className="btn-outline !px-2 !py-1.5" onClick={() => openEdit(b)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button className="btn-danger !px-2 !py-1.5" onClick={() => setDeleteId(b.id)}>
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

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Booking' : 'Add Booking'}
        className="max-w-2xl"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium">Customer</label>
              <select {...register('customerId')} className="luxury-input">
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.phone ? ` (${c.phone})` : ''}
                  </option>
                ))}
              </select>
              {errors.customerId && <p className="mt-1 text-xs text-red-600">{errors.customerId.message}</p>}
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium">Unit</label>
              <select
                className="luxury-input"
                value={selectedUnitId || ''}
                onChange={(e) => {
                  const unitId = e.target.value;
                  setValue('unitId', unitId, { shouldValidate: true });
                  const unit = unitOptions.find((u) => u.id === unitId);
                  if (unit && !editing) {
                    setValue('totalAmount', Number(unit.price) || 0);
                  }
                }}
              >
                <option value="">Select available unit</option>
                {unitOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unitNumber}
                    {u.floor?.building?.project?.name ? ` — ${u.floor.building.project.name}` : ''}
                    {u.floor?.building?.name ? ` / ${u.floor.building.name}` : ''}
                    {` (${formatCurrency(Number(u.price))})`}
                  </option>
                ))}
              </select>
              {errors.unitId && <p className="mt-1 text-xs text-red-600">{errors.unitId.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Total Amount</label>
              <input {...register('totalAmount')} type="number" className="luxury-input" />
              {errors.totalAmount && <p className="mt-1 text-xs text-red-600">{errors.totalAmount.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Down Payment</label>
              <input {...register('downPayment')} type="number" className="luxury-input" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Discount</label>
              <input {...register('discount')} type="number" className="luxury-input" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Status</label>
              <select {...register('status')} className="luxury-input">
                {BOOKING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Possession Date</label>
              <input {...register('possessionDate')} type="date" className="luxury-input" />
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
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={() => confirmId && confirmMutation.mutate(confirmId)}
        title="Confirm Booking"
        message="This will confirm the booking, update unit status, generate installments, and record the down payment."
        confirmLabel="Confirm Booking"
        loading={confirmMutation.isPending}
      />

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Delete Booking"
        message="Are you sure you want to delete this booking? The unit will be marked available again."
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
