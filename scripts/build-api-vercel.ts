/**
 * Bundle Express API for Vercel serverless (@vercel/node).
 */
import { spawnSync } from 'child_process';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(cmd: string, args: string[]) {
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run(npmBin, ['run', 'build:api']);
run(npmBin, [
  'exec',
  '--',
  'esbuild',
  'apps/api/dist/index.js',
  '--bundle',
  '--platform=node',
  '--target=node20',
  '--outfile=apps/api/api/handler.js',
  '--packages=external',
]);

console.log('[build-api-vercel] handler.js ready');
