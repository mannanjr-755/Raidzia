import { prisma } from '@/lib/db';
import { requireAuth, apiSuccess, apiError, isNextResponse, parsePagination } from '@/lib/api/helpers';

export async function GET(request: Request) {
  const ctx = await requireAuth('notifications:read');
  if (isNextResponse(ctx)) return ctx;
  const { searchParams } = new URL(request.url);
  const { page, limit } = parsePagination(searchParams);
  const unreadOnly = searchParams.get('unread') === 'true';

  const where = {
    userId: ctx.userId,
    ...(unreadOnly ? { isRead: false } : {}),
  };

  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: ctx.userId, isRead: false } }),
  ]);

  return apiSuccess({ items, total, unreadCount, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function PATCH(request: Request) {
  const ctx = await requireAuth('notifications:read');
  if (isNextResponse(ctx)) return ctx;
  const body = await request.json();

  if (body.markAllRead) {
    await prisma.notification.updateMany({
      where: { userId: ctx.userId, isRead: false },
      data: { isRead: true },
    });
    return apiSuccess({ updated: true });
  }

  if (body.id) {
    await prisma.notification.updateMany({
      where: { id: body.id, userId: ctx.userId },
      data: { isRead: true },
    });
    return apiSuccess({ id: body.id });
  }

  return apiError('Invalid request');
}
