'use client';

import { cn } from '@/lib/utils/cn';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DataTableProps<T> {
  columns: { key: string; label: string; render?: (item: T) => React.ReactNode }[];
  data: T[];
  loading?: boolean;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  onSort?: (key: string) => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  emptyMessage?: string;
  actions?: (item: T) => React.ReactNode;
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  loading,
  page,
  totalPages,
  total,
  onPageChange,
  onSort,
  sortBy,
  sortOrder,
  emptyMessage = 'No records found',
  actions,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="rounded-xl border">
        <div className="p-8 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="rounded-xl border p-12 text-center">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn('px-4 py-3 text-left font-medium text-muted-foreground', onSort && 'cursor-pointer hover:text-foreground')}
                  onClick={() => onSort?.(col.key)}
                >
                  {col.label}
                  {sortBy === col.key && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
                </th>
              ))}
              {actions && <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    {col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
                {actions && <td className="px-4 py-3 text-right">{actions(item)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
        <p className="text-sm text-muted-foreground">{total} total records</p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => onPageChange(1)}>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-3 text-sm">Page {page} of {totalPages || 1}</span>
          <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
