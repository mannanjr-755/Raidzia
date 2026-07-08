import { PrismaClient } from '@prisma/client';

const adminUrl = 'postgresql://ledgerpro:ledgerpro123@localhost:5433/ledgerpro';
const prisma = new PrismaClient({ datasources: { db: { url: adminUrl } } });

async function main() {
  try {
    await prisma.$executeRawUnsafe('CREATE DATABASE rss_erp');
    console.log('Database rss_erp created.');
  } catch (e: unknown) {
    const msg = (e as Error).message || '';
    if (msg.includes('already exists')) {
      console.log('Database rss_erp already exists.');
    } else {
      throw e;
    }
  }
}

main().finally(() => prisma.$disconnect());
