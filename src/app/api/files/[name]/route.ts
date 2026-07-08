import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/session-manager';

export async function GET(_: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await params;
  const safeName = path.basename(name);
  const file = await prisma.uploadedFile.findFirst({ where: { storedName: safeName } });
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const uploadDir = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
  const buffer = await readFile(path.join(uploadDir, safeName));

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename="${file.filename}"`,
    },
  });
}
