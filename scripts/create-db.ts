import { PrismaClient } from '@prisma/client';

const adminUrl = 'postgresql://ledgerpro:ledgerpro123@localhost:5433/ledgerpro';

const MAX_RETRIES = 15;
const RETRY_DELAY_MS = 1000;

async function waitForReady(): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const prisma = new PrismaClient({ datasources: { db: { url: adminUrl } } });
    try {
      await prisma.$executeRawUnsafe('SELECT 1');
      await prisma.$disconnect();
      return;
    } catch (e: unknown) {
      await prisma.$disconnect();
      const msg = (e as Error).message || '';
      if (!msg.includes('starting up')) {
        return;
      }
      if (attempt === MAX_RETRIES) throw e;
      console.log(`PostgreSQL still starting (attempt ${attempt}/${MAX_RETRIES}), retrying...`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
}

async function main() {
  await waitForReady();

  const prisma = new PrismaClient({ datasources: { db: { url: adminUrl } } });
  try {
    const rows = await prisma.$queryRawUnsafe<{ datname: string }[]>(
      "SELECT datname FROM pg_database WHERE datname = 'rss_erp'"
    );
    if (rows.length > 0) {
      console.log('Database rss_erp already exists.');
      return;
    }

    await prisma.$executeRawUnsafe('CREATE DATABASE rss_erp');
    console.log('Database rss_erp created.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
