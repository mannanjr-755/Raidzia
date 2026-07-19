/**
 * Vercel frontend build for this monorepo.
 *
 * Problem: repo root has next.config.ts + next in package.json, so Vercel
 * treats the monorepo root as the Next.js app and expects ./.next.
 * `build:cdn` correctly builds into apps/web/.next.
 *
 * This script runs the CDN-safe build, then stages apps/web/.next → ./.next
 * (and public assets) so the Vercel Next.js builder finds the output.
 *
 * Preferred alternative: set Vercel Root Directory to `apps/web` and use
 * apps/web/vercel.json (no staging needed).
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const WEB_NEXT = path.join(ROOT, 'apps', 'web', '.next');
const ROOT_NEXT = path.join(ROOT, '.next');
const WEB_PUBLIC = path.join(ROOT, 'apps', 'web', 'public');
const ROOT_PUBLIC = path.join(ROOT, 'public');
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function rimraf(target: string) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function copyDir(src: string, dest: string) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

function main() {
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    VERCEL: process.env.VERCEL || '1',
    SKIP_PRIVATE_API_REWRITE: 'true',
    ALLOW_PRIVATE_API_REWRITE: 'false',
    SKIP_PRISMA_GENERATE: process.env.SKIP_PRISMA_GENERATE || 'true',
  };

  console.log('[build-vercel] Running CDN-safe monorepo web build…');
  const build = spawnSync(npmBin, ['run', 'build:cdn'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
    env: childEnv,
  });
  if (build.status !== 0) process.exit(build.status ?? 1);

  if (!fs.existsSync(WEB_NEXT)) {
    console.error('[build-vercel] FATAL: apps/web/.next missing after build:cdn');
    process.exit(1);
  }

  // When Vercel Root Directory is apps/web, staging is unnecessary — skip.
  // Detect: cwd package is @rss/web (Root Directory = apps/web).
  const pkgPath = path.join(process.cwd(), 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { name?: string };
      if (pkg.name === '@rss/web') {
        console.log('[build-vercel] Root Directory is apps/web — output already correct.');
        process.exit(0);
      }
    } catch {
      /* continue with staging */
    }
  }

  console.log('[build-vercel] Staging apps/web/.next → ./.next for monorepo-root Vercel projects');
  rimraf(ROOT_NEXT);
  copyDir(WEB_NEXT, ROOT_NEXT);

  if (fs.existsSync(WEB_PUBLIC)) {
    fs.mkdirSync(ROOT_PUBLIC, { recursive: true });
    for (const entry of fs.readdirSync(WEB_PUBLIC)) {
      const from = path.join(WEB_PUBLIC, entry);
      const to = path.join(ROOT_PUBLIC, entry);
      rimraf(to);
      copyDir(from, to);
    }
    console.log('[build-vercel] Synced apps/web/public → ./public');
  }

  console.log('[build-vercel] Success — Vercel can package ./.next as Next.js');
}

main();
