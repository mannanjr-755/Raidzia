/**
 * Verify production build outputs exist before deploy.
 * Used in CI and can be run locally: npm run verify:build
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');

const required = [
  'apps/api/dist/index.js',
  'packages/shared/dist/index.js',
  'apps/web/.next/BUILD_ID',
];

let failed = false;

for (const file of required) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) {
    console.error(`MISSING: ${file}`);
    failed = true;
  } else {
    console.log(`OK  ${file}`);
  }
}

if (failed) {
  console.error('\nBuild verification failed. Run: npm run build');
  process.exit(1);
}

console.log('\nBuild verification passed.');
