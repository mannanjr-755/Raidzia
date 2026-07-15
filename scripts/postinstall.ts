/**
 * Install-time Prisma client generation.
 * Skips when SKIP_PRISMA_GENERATE=true (e.g. Netlify frontend-only deploy).
 */
import { spawnSync } from 'child_process';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const prismaBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function generate(schema: string): boolean {
  const result = spawnSync(prismaBin, ['prisma', 'generate', `--schema=${schema}`], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
  });
  return result.status === 0;
}

function main() {
  if (process.env.SKIP_PRISMA_GENERATE === 'true' || process.env.SKIP_PRISMA_GENERATE === '1') {
    console.log('Skipping Prisma generate (SKIP_PRISMA_GENERATE is set)');
    process.exit(0);
  }

  const apiOk = generate('apps/api/prisma/schema.prisma');
  if (!apiOk) {
    console.error('Failed to generate API Prisma client');
    process.exit(1);
  }

  // Legacy root schema — only needed for the old src/ app, not for apps/web deploys
  if (process.env.SKIP_LEGACY_PRISMA !== 'true' && process.env.SKIP_LEGACY_PRISMA !== '1') {
    const legacyOk = generate('prisma/schema.prisma');
    if (!legacyOk) {
      console.warn('Warning: legacy Prisma client generation failed (non-fatal for apps/web)');
    }
  }
}

main();
