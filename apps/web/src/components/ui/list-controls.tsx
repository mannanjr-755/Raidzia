'use client';

import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

export interface FilterOption {
  label: string;
  value: string;
}

interface ListToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: {
    key: string;
    label: string;
    value: string;
    options: FilterOption[];
    onChange: (value: string) => void;
  }[];
  action?: React.ReactNode;
}

export function ListToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters = [],
  action,
}: ListToolbarProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-luxury-slate" />
          <input
            className="luxury-input pl-10"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        {filters.map((filter) => (
          <select
            key={filter.key}
            className="luxury-input max-w-[200px]"
            value={filter.value}
            onChange={(e) => filter.onChange(e.target.value)}
            aria-label={filter.label}
          >
            <option value="">{filter.label}</option>
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ))}
      </div>
      {action}
    </div>
  );
}

interface PaginationBarProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export function PaginationBar({ page, totalPages, total, limit, onPageChange }: PaginationBarProps) {
  if (totalPages <= 1) {
    return total > 0 ? (
      <p className="mt-4 text-sm text-luxury-slate">
        Showing {total} {total === 1 ? 'item' : 'items'}
      </p>
    ) : null;
  }

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-luxury-slate">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn-outline !px-3 !py-1.5"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </button>
        <span className="min-w-[5rem] text-center text-sm text-luxury-charcoal">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          className="btn-outline !px-3 !py-1.5"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
