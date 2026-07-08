'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageHeader, LoadingSpinner, EmptyState } from '@/components/ui/stat-card';

interface PlaceholderPageProps {
  title: string;
  description: string;
  endpoint?: string;
  renderItem?: (item: Record<string, unknown>) => React.ReactNode;
}

export function DataListPage({ title, description, endpoint, renderItem }: PlaceholderPageProps) {
  const { data, isLoading } = useQuery({
    queryKey: [endpoint],
    queryFn: () => api.get<Record<string, unknown>[] | { items: Record<string, unknown>[] }>(endpoint!),
    enabled: !!endpoint,
  });

  const items = Array.isArray(data) ? data : (data as { items?: Record<string, unknown>[] })?.items || [];

  return (
    <div>
      <PageHeader title={title} description={description} />
      {!endpoint ? (
        <div className="luxury-card p-16 text-center">
          <p className="text-luxury-slate">Module coming soon</p>
        </div>
      ) : isLoading ? (
        <LoadingSpinner />
      ) : !items.length ? (
        <EmptyState message={`No ${title.toLowerCase()} data found.`} />
      ) : (
        <div className="luxury-card divide-y divide-luxury-border">
          {items.map((item, i) => (
            <div key={(item.id as string) || i} className="p-4">
              {renderItem ? renderItem(item) : (
                <pre className="text-xs text-luxury-slate overflow-auto">{JSON.stringify(item, null, 2)}</pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
