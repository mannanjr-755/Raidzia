import { spawnSync } from 'child_process';
import { spawn } from 'child_process';
import net from 'net';
import { PrismaClient } from '@prisma/client';

const POSTGRES_PORT = 5433;

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

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed`);
  }
}

async function main() {
  if (!(await isPortOpen(POSTGRES_PORT))) {
    console.log('Starting embedded PostgreSQL...');
    const pg = spawn('npx', ['tsx', 'scripts/start-postgres.ts'], {
      cwd: process.cwd(),
      stdio: 'ignore',
      shell: true,
      detached: true,
    });
    pg.unref();
    await waitForPort(POSTGRES_PORT, 'PostgreSQL');
  }

  run('npm', ['run', 'db:create']);
  run('npm', ['run', 'db:generate', '--workspace=@rss/api']);
  run('npm', ['run', 'db:push', '--workspace=@rss/api']);

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
