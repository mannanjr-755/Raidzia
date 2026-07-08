'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Check } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { PageHeader, LoadingSpinner, EmptyState } from '@/components/ui/stat-card';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  link?: string;
  createdAt: string;
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<Notification[]>('/notifications'),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Marked as read');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title="Notifications" description="System alerts and updates" />

      {isLoading ? (
        <LoadingSpinner />
      ) : !data?.length ? (
        <EmptyState message="No notifications." />
      ) : (
        <div className="space-y-3">
          {data.map((n) => (
            <div
              key={n.id}
              className={`luxury-card p-4 flex items-start gap-4 ${!n.isRead ? 'border-l-4 border-l-gold' : ''}`}
            >
              <div className={`rounded-lg p-2 ${n.isRead ? 'bg-luxury-cream' : 'bg-gold-50'}`}>
                <Bell className="h-5 w-5 text-gold" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-luxury-charcoal">{n.title}</p>
                  <span className="rounded-full bg-luxury-cream px-2 py-0.5 text-[10px] text-luxury-slate">{n.type}</span>
                </div>
                <p className="text-sm text-luxury-slate mt-1">{n.message}</p>
                <p className="text-xs text-luxury-slate/70 mt-2">{formatDate(n.createdAt)}</p>
              </div>
              {!n.isRead && (
                <button
                  className="btn-outline !px-2 !py-1.5 shrink-0"
                  onClick={() => markReadMutation.mutate(n.id)}
                  disabled={markReadMutation.isPending}
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
