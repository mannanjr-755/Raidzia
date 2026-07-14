import type { Request } from 'express';

export function getPagination(req: Request, defaultLimit = 10) {
  const page = Math.max(1, parseInt(String(req.query.page || 1), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || defaultLimit), 10) || defaultLimit));
  const search = String(req.query.search || '').trim();
  const skip = (page - 1) * limit;
  return { page, limit, search, skip };
}

export function paginated<T>(items: T[], total: number, page: number, limit: number) {
  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
