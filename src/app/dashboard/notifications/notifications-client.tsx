'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Bell, CheckCheck, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/data-table/data-table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiFetch, formatDate } from '@/lib/api/client';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  link?: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  items: Notification[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

function typeVariant(type: string): 'default' | 'secondary' | 'success' | 'warning' | 'destructive' {
  switch (type) {
    case 'SUCCESS': return 'success';
    case 'WARNING': return 'warning';
    case 'ERROR': return 'destructive';
    default: return 'secondary';
  }
}

export function NotificationsPageClient() {
  const [data, setData] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [search, setSearch] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewing, setViewing] = useState<Notification | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: '10' });
    if (unreadOnly) qs.set('unread', 'true');
    const res = await apiFetch<NotificationsResponse>(`/api/notifications?${qs}`);
    if (res.success && res.data) {
      let items = res.data.items;
      if (search) {
        const q = search.toLowerCase();
        items = items.filter((n) => n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q));
      }
      setData(items);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
      setUnreadCount(res.data.unreadCount);
    }
    setLoading(false);
  }, [page, unreadOnly, search]);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id: string) => {
    const res = await apiFetch('/api/notifications', { method: 'PATCH', body: JSON.stringify({ id }) });
    if (res.success) {
      toast.success('Notification marked as read');
      load();
    } else {
      toast.error(res.error || 'Failed to mark as read');
    }
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    const res = await apiFetch('/api/notifications', { method: 'PATCH', body: JSON.stringify({ markAllRead: true }) });
    setMarkingAll(false);
    if (res.success) {
      toast.success('All notifications marked as read');
      load();
    } else {
      toast.error(res.error || 'Failed to mark all as read');
    }
  };

  const openView = (item: Notification) => {
    setViewing(item);
    setViewOpen(true);
    if (!item.isRead) markRead(item.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-muted-foreground text-sm">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up'}
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" onClick={markAllRead} loading={markingAll} disabled={markingAll}>
              <CheckCheck className="h-4 w-4" /> Mark All Read
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="Search notifications..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="h-11 rounded-lg border border-input bg-background px-3 text-sm" value={unreadOnly ? 'unread' : 'all'} onChange={(e) => { setUnreadOnly(e.target.value === 'unread'); setPage(1); }}>
          <option value="all">All Notifications</option>
          <option value="unread">Unread Only</option>
        </select>
      </div>

      <DataTable
        columns={[
          {
            key: 'title',
            label: 'Title',
            render: (i) => (
              <div className="flex items-center gap-2">
                {!i.isRead && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                <span className={i.isRead ? 'text-muted-foreground' : 'font-medium'}>{i.title}</span>
              </div>
            ),
          },
          { key: 'message', label: 'Message', render: (i) => <span className="line-clamp-1">{i.message}</span> },
          {
            key: 'type',
            label: 'Type',
            render: (i) => <Badge variant={typeVariant(i.type)}>{i.type}</Badge>,
          },
          { key: 'createdAt', label: 'Date', render: (i) => formatDate(i.createdAt) },
          {
            key: 'isRead',
            label: 'Status',
            render: (i) => (
              <Badge variant={i.isRead ? 'secondary' : 'default'}>{i.isRead ? 'Read' : 'Unread'}</Badge>
            ),
          },
        ]}
        data={data}
        loading={loading}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        emptyMessage="No notifications found"
        actions={(item) => (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" onClick={() => openView(item)}><Bell className="h-4 w-4" /></Button>
            {!item.isRead && (
              <Button variant="ghost" size="icon" onClick={() => markRead(item.id)}><CheckCheck className="h-4 w-4" /></Button>
            )}
          </div>
        )}
      />

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{viewing?.title}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-4 text-sm">
              <div className="flex gap-2">
                <Badge variant={typeVariant(viewing.type)}>{viewing.type}</Badge>
                <Badge variant={viewing.isRead ? 'secondary' : 'default'}>{viewing.isRead ? 'Read' : 'Unread'}</Badge>
              </div>
              <p>{viewing.message}</p>
              <p className="text-muted-foreground">{formatDate(viewing.createdAt)}</p>
              {viewing.link && (
                <Button variant="outline" asChild>
                  <a href={viewing.link}>View Related</a>
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
