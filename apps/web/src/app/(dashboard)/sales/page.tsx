'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api, type PaginatedResponse } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PageHeader, LoadingSpinner, EmptyState } from '@/components/ui/stat-card';
import { ConfirmDialog } from '@/components/ui/modal';

interface Booking {
  id: string;
  bookingNumber: string;
  status: string;
  totalAmount: number | string;
  downPayment: number | string;
  createdAt: string;
  customer: { name: string; phone?: string };
  unit?: {
    unitNumber: string;
    floor?: { building?: { name: string; project?: { name: string } } };
  };
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-50 text-yellow-700',
  CONFIRMED: 'bg-green-50 text-green-700',
  CANCELLED: 'bg-red-50 text-red-700',
};

export default function SalesPage() {
  const queryClient = useQueryClient();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => api.get<PaginatedResponse<Booking>>('/crm/bookings?limit=50'),
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => api.post<Booking>(`/crm/bookings/${id}/confirm`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success('Booking confirmed successfully');
      setConfirmId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Sales"
        description="Manage property bookings and confirmations"
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
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[b.status] || 'bg-gray-50'}`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-luxury-slate">{formatDate(b.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {b.status === 'PENDING' && (
                        <button className="btn-gold !px-3 !py-1.5" onClick={() => setConfirmId(b.id)}>
                          <CheckCircle className="h-3.5 w-3.5" /> Confirm
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

      <ConfirmDialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={() => confirmId && confirmMutation.mutate(confirmId)}
        title="Confirm Booking"
        message="This will confirm the booking, update unit status, generate installments, and record the down payment."
        confirmLabel="Confirm Booking"
        loading={confirmMutation.isPending}
      />
    </div>
  );
}
