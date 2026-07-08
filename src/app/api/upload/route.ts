import { NextRequest } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/db';
import { requireAuth, apiSuccess, apiError, isNextResponse } from '@/lib/api/helpers';

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export async function POST(request: NextRequest) {
  const ctx = await requireAuth('expenses:write');
  if (isNextResponse(ctx)) return ctx;

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const entityType = (formData.get('entityType') as string) || 'expense';
  const entityId = (formData.get('entityId') as string) || null;

  if (!file) return apiError('No file uploaded');
  if (file.size > MAX_SIZE) return apiError('File too large (max 5MB)');
  if (!ALLOWED_TYPES.includes(file.type)) return apiError('Invalid file type');

  const uploadDir = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
  await mkdir(uploadDir, { recursive: true });

  const storedName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  const filePath = path.join(uploadDir, storedName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  const uploaded = await prisma.uploadedFile.create({
    data: {
      filename: file.name,
      storedName,
      mimeType: file.type,
      size: file.size,
      path: `/api/files/${storedName}`,
      entityType,
      entityId,
      uploadedBy: ctx.userId,
    },
  });

  return apiSuccess(uploaded, 201);
}
