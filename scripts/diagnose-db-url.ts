import fs from 'fs';

const file = process.argv[2] || '.env.vercel.pull.tmp';
const t = fs.readFileSync(file, 'utf8');
const m = t.match(/^DATABASE_URL=(.*)$/m);
if (!m) {
  console.log('no_line');
  process.exit(0);
}
const v = m[1];
console.log('raw_len=' + v.length);
console.log('first_char_code=' + v.charCodeAt(0));
console.log('last_char_code=' + v.charCodeAt(v.length - 1));
console.log('starts_with_quote=' + (v[0] === '"' || v[0] === "'"));
console.log('includes_postgres=' + /postgres/i.test(v));
console.log('includes_prisma=' + /prisma\.tech|prisma\.io/i.test(v));
console.log('includes_neon=' + /neon\.tech/i.test(v));
console.log('includes_supabase=' + /supabase/i.test(v));
console.log('includes_localhost=' + /localhost|127\.0\.0\.1/i.test(v));
console.log('includes_at=' + v.includes('@'));
console.log('pct_encoded=' + /%[0-9A-Fa-f]{2}/.test(v));
let cleaned = v;
if (
  (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
  (cleaned.startsWith("'") && cleaned.endsWith("'"))
) {
  cleaned = cleaned.slice(1, -1);
}
console.log('cleaned_len=' + cleaned.length);
console.log('cleaned_prefix=' + JSON.stringify(cleaned.slice(0, 14)));
try {
  const u = new URL(cleaned.replace(/^postgresql:/i, 'http:').replace(/^postgres:/i, 'http:'));
  console.log('parse=ok');
  console.log('host_hint=' + u.hostname.split('.').slice(-2).join('.'));
  console.log('local=' + /^(localhost|127\.0\.0\.1)$/.test(u.hostname));
} catch (e) {
  console.log('parse_fail=' + (e instanceof Error ? e.name : 'err'));
  const idx = cleaned.indexOf('://');
  console.log('scheme=' + JSON.stringify(cleaned.slice(0, Math.max(0, idx))));
  // Check for common issues
  console.log('has_space=' + /\s/.test(cleaned));
  console.log('has_angle=' + /[<>]/.test(cleaned));
}
