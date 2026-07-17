import { spawnSync } from 'child_process';
import { spawn } from 'child_process';
import fs from 'fs';
import net from 'net';
import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../apps/api/.env'), override: true });

const POSTGRES_PORT = 5433;
const ROOT = path.resolve(__dirname, '..');
const QUERY_ENGINE = path.join(
  ROOT,
  'node_modules',
  '.prisma',
  'client',
  'query_engine-windows.dll.node'
);

function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port, timeout: 2000 });
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function waitForPort(port: number, label: string, maxAttempts = 120): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    if (await isPortOpen(port)) {
      console.log(`${label} ready on port ${port}`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${label} did not become ready on port ${port}`);
}

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed`);
  }
}

function runCapture(command: string, args: string[]): { status: number; stderr: string; stdout: string } {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
  });
  return {
    status: result.status ?? 1,
    stderr: String(result.stderr || ''),
    stdout: String(result.stdout || ''),
  };
}

function prismaClientExists(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require.resolve('@prisma/client');
    return fs.existsSync(QUERY_ENGINE) || process.platform !== 'win32';
  } catch {
    return false;
  }
}

function generatePrismaClient(): void {
  console.log('Generating Prisma client...');
  const result = runCapture('npm', ['run', 'db:generate', '--workspace=@rss/api']);

  if (result.status === 0) {
    console.log('Prisma client generated.');
    return;
  }

  const output = `${result.stdout}\n${result.stderr}`;
  const isEperm =
    output.includes('EPERM') ||
    output.includes('operation not permitted') ||
    output.includes('EACCES');

  if (isEperm && prismaClientExists()) {
    console.warn(
      'Prisma generate skipped: query engine file is locked by another process (EPERM).\n' +
        'Using the existing Prisma client. Stop other Node/API processes if the schema changed.'
    );
    return;
  }

  console.error(output);
  throw new Error('npm run db:generate --workspace=@rss/api failed');
}

function runWithRetry(command: string, args: string[], maxRetries = 3): void {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      run(command, args);
      return;
    } catch (e: unknown) {
      const msg = (e as Error).message || '';
      if (attempt === maxRetries || !msg.includes('starting up')) {
        throw e;
      }
      console.log(`Command failed (attempt ${attempt}/${maxRetries}), retrying in 2s...`);
      const end = Date.now() + 2000;
      while (Date.now() < end) {
        /* sync wait */
      }
    }
  }
}

async function main() {
  if (!(await isPortOpen(POSTGRES_PORT))) {
    console.log('Starting embedded PostgreSQL...');
    const pg = spawn('npx', ['tsx', 'scripts/start-postgres.ts'], {
      cwd: ROOT,
      stdio: 'ignore',
      shell: true,
      detached: true,
    });
    pg.unref();
    await waitForPort(POSTGRES_PORT, 'PostgreSQL');
  }

  runWithRetry('npm', ['run', 'db:create']);
  generatePrismaClient();
  // Skip generate here — regenerating locks the Windows query engine and crashes
  // any already-running API (tsx watch), which then races with a new API start.
  runWithRetry('npm', ['run', 'db:push', '--workspace=@rss/api', '--', '--skip-generate']);

  const prisma = new PrismaClient();
  try {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      run('npm', ['run', 'db:seed', '--workspace=@rss/api']);
    } else {
      console.log(`Database already seeded (${userCount} users).`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
