/**
 * Install-time Prisma client generation.
 *
 * Windows: if a Node process holds query_engine-windows.dll.node, Prisma generate
 * fails with EPERM. We retry, then reuse the existing client so `npm install` succeeds.
 *
 * Skips when SKIP_PRISMA_GENERATE=true or on Netlify/Vercel (frontend-only).
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { generateApiPrismaClient } from './prisma-generate-api';

const ROOT = path.resolve(__dirname, '..');
const prismaBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function generateLegacy(maxAttempts = 2): boolean {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[postinstall] Generating legacy Prisma client (attempt ${attempt}/${maxAttempts})…`);
    const result = spawnSync(prismaBin, ['prisma', 'generate', '--schema=prisma/schema.prisma'], {
      cwd: ROOT,
      encoding: 'utf8',
      shell: true,
    });
    const output = `${result.stdout || ''}\n${result.stderr || ''}`;
    if (result.status === 0) {
      process.stdout.write(output);
      console.log('[postinstall] legacy Prisma client ready.');
      return true;
    }
    process.stderr.write(output);
    if (attempt < maxAttempts) {
      const end = Date.now() + attempt * 1000;
      while (Date.now() < end) {
        /* wait */
      }
    }
  }
  return false;
}

function main() {
  if (process.env.SKIP_PRISMA_GENERATE === 'true' || process.env.SKIP_PRISMA_GENERATE === '1') {
    console.log('[postinstall] Skipping Prisma generate (SKIP_PRISMA_GENERATE is set)');
    process.exit(0);
  }

  if (process.env.NETLIFY === 'true' || process.env.VERCEL === '1' || process.env.CF_PAGES === '1') {
    console.log('[postinstall] CDN host detected — skipping Prisma generate (frontend-only).');
    process.exit(0);
  }

  console.log('[postinstall] Generating API Prisma client…');
  if (!generateApiPrismaClient()) {
    console.error('[postinstall] Failed to generate API Prisma client');
    process.exit(1);
  }
  console.log('[postinstall] API Prisma client ready.');

  if (process.env.SKIP_LEGACY_PRISMA !== 'true' && process.env.SKIP_LEGACY_PRISMA !== '1') {
    if (!generateLegacy()) {
      console.warn(
        '[postinstall] Legacy Prisma client generation failed (non-fatal for apps/web + apps/api).'
      );
    }
  }

  process.exit(0);
}

main();
