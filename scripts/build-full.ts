/**
 * Full-stack production build (API + Web on the same machine).
 * Enables private /api → 127.0.0.1 rewrites for Railway/Render/Docker/local.
 */
import { spawnSync } from 'child_process';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';

process.env.ALLOW_PRIVATE_API_REWRITE = 'true';
delete process.env.SKIP_PRIVATE_API_REWRITE;
delete process.env.NETLIFY;
delete process.env.VERCEL;
delete process.env.CF_PAGES;

function run(args: string[]) {
  const result = spawnSync(npmBin, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(['run', 'build', '--workspace=@rss/shared']);
run(['run', 'build', '--workspace=@rss/api']);
run(['run', 'build', '--workspace=@rss/web']);

console.log('[build-full] Done (ALLOW_PRIVATE_API_REWRITE=true)');
