import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      success: true,
      message: 'RSS ERP API is healthy',
      database: 'connected',
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: 'Database unavailable',
        database: 'disconnected',
      },
      { status: 503 }
    );
  }
}
