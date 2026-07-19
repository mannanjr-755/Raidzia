/**
 * Inspect DATABASE_URL from Vercel env pull without printing secrets.
 * Usage: npx tsx scripts/inspect-db-host.ts [.env.file]
 */
import fs from 'fs';
import path from 'path';

const file = path.resolve(process.argv[2] || '.vercel/.env.production.local');
if (!fs.existsSync(file)) {
  console.log('status=missing_file');
  process.exit(1);
}

const env: Record<string, string> = {};
for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
  if (!line || line.startsWith('#') || !line.includes('=')) continue;
  const i = line.indexOf('=');
  const key = line.slice(0, i);
  let val = line.slice(i + 1);
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  env[key] = val;
}

const raw = env.DATABASE_URL || '';
if (!raw) {
  console.log('status=no_database_url');
  process.exit(1);
}

try {
  const host = new URL(raw.replace(/^postgresql:/i, 'http:')).hostname;
  const local = host === 'localhost' || host === '127.0.0.1';
  const parts = host.split('.');
  const hint = parts.length >= 2 ? parts.slice(-2).join('.') : host;
  console.log(`status=ok`);
  console.log(`db_local=${local}`);
  console.log(`db_host_hint=${hint}`);
  console.log(`has_jwt=${Boolean(env.JWT_SECRET)}`);
  console.log(`has_jwt_refresh=${Boolean(env.JWT_REFRESH_SECRET)}`);
} catch {
  console.log('status=parse_error');
  process.exit(1);
}
