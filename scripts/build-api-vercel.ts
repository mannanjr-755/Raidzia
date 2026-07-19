/**
 * Bundle Express API entry for Vercel — writes directly to api/index.js.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const outFile = path.join(ROOT, 'apps/api/api/index.js');

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
  '--outfile=apps/api/api/index.js',
  '--packages=external',
]);

if (!fs.existsSync(outFile) || fs.statSync(outFile).size < 1000) {
  console.error('[build-api-vercel] api/index.js bundle missing or too small');
  process.exit(1);
}

console.log(`[build-api-vercel] api/index.js ready (${fs.statSync(outFile).size} bytes)`);
