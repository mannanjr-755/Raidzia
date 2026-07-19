/**
 * Generate the API Prisma client with Windows EPERM tolerance.
 * Used by postinstall and @rss/api build.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const SCHEMA = 'apps/api/prisma/schema.prisma';
const prismaBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const ENGINE_WIN = path.join(ROOT, 'node_modules', '.prisma', 'client', 'query_engine-windows.dll.node');
const CLIENT_INDEX = path.join(ROOT, 'node_modules', '.prisma', 'client', 'index.js');

function clientUsable(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require.resolve('@prisma/client');
  } catch {
    return false;
  }
  if (!fs.existsSync(CLIENT_INDEX)) return false;
  if (process.platform === 'win32') return fs.existsSync(ENGINE_WIN);
  return true;
}

function isLockError(output: string): boolean {
  return /EPERM|EACCES|EBUSY|operation not permitted|resource busy|cannot access the file/i.test(
    output
  );
}

export function generateApiPrismaClient(maxAttempts = 3): boolean {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = spawnSync(prismaBin, ['prisma', 'generate', `--schema=${SCHEMA}`], {
      cwd: ROOT,
      encoding: 'utf8',
      shell: true,
    });
    const output = `${result.stdout || ''}\n${result.stderr || ''}`;
    if (result.status === 0) {
      process.stdout.write(output);
      return true;
    }
    process.stderr.write(output);

    if (isLockError(output) && attempt < maxAttempts) {
      const waitMs = attempt * 1500;
      console.warn(`[prisma-generate-api] EPERM — retry in ${waitMs}ms (${attempt}/${maxAttempts})`);
      const end = Date.now() + waitMs;
      while (Date.now() < end) {
        /* sync wait */
      }
      continue;
    }

    if (isLockError(output) && clientUsable()) {
      console.warn(
        '[prisma-generate-api] EPERM — using existing Prisma client (stop npm run dev to regenerate).'
      );
      return true;
    }

    return false;
  }
  return false;
}

if (require.main === module) {
  const ok = generateApiPrismaClient();
  process.exit(ok ? 0 : 1);
}
