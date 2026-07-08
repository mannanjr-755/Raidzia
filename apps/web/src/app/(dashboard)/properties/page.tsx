'use client';

import { useQuery } from '@tanstack/react-query';
import { api, type PaginatedResponse } from '@/lib/api';
import { PageHeader, LoadingSpinner, EmptyState } from '@/components/ui/stat-card';

interface Project {
  id: string;
  name: string;
  code: string;
  location: string;
  status: string;
  completionPct: number | string;
}

export default function PropertiesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['properties'],
    queryFn: () => api.get<PaginatedResponse<Project>>('/projects?limit=50'),
  });

  return (
    <div>
      <PageHeader title="Properties" description="View properties across all projects" />
      {isLoading ? (
        <LoadingSpinner />
      ) : !data?.items.length ? (
        <EmptyState message="No properties found." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((p) => (
            <div key={p.id} className="luxury-card p-5">
              <span className="text-xs font-mono text-gold">{p.code}</span>
              <h3 className="font-semibold text-luxury-charcoal mt-1">{p.name}</h3>
              <p className="text-sm text-luxury-slate">{p.location}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="rounded-full bg-gold-50 px-2 py-0.5 text-xs text-gold-700">{p.status}</span>
                <span className="text-sm font-medium">{Number(p.completionPct)}% complete</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
