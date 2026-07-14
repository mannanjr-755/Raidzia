import type { ApiResponse, PaginatedResponse } from '@/types';

export async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    });

    const text = await res.text();
    const data = text ? (JSON.parse(text) as ApiResponse<T>) : null;

    if (!data) {
      return { success: false, error: `Empty response from API (${res.status})` };
    }

    if (!res.ok) {
      return {
        success: false,
        error: data.error || data.message || `Request failed (${res.status})`,
      };
    }

    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unable to reach the API',
    };
  }
}

export async function fetchPaginated<T>(
  baseUrl: string,
  params: Record<string, string | number | undefined>
): Promise<PaginatedResponse<T>> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  });
  const res = await apiFetch<PaginatedResponse<T>>(`${baseUrl}?${qs}`);
  if (!res.success || !res.data) throw new Error(res.error || 'Failed to fetch');
  return res.data;
}

export function downloadFile(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

export function formatCurrency(value: number | string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value));
}

export function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
