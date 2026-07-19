/**
 * Provision production API wiring using Neon + Vercel.
 * Secrets are never printed.
 */
import { spawnSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const TEAM_ID = 'team_EGuL8sb47Ni8qSAC2sCvEHGK';
const FRONTEND_PROJECT_ID = 'prj_Jt4NPv1m2awWnCTcYi8GuhVGMMcJ';
const NEON_PROJECT_ID = process.env.NEON_PROJECT_ID || 'silent-frog-83351477';
const NEON_ORG = process.env.NEON_ORG_ID || 'org-wispy-mud-06901002';
const FRONTEND_ORIGINS = [
  'https://raidzia-api.vercel.app',
  'https://raidzia-api-abdulmannans-projects-6f82c578.vercel.app',
  'https://raidzia.vercel.app',
  'https://raidzia-abdulmannans-projects-6f82c578.vercel.app',
].join(',');

function loadAuthToken(): string {
  const authPath = path.join(process.env.APPDATA || '', 'xdg.data', 'com.vercel.cli', 'auth.json');
  const auth = JSON.parse(fs.readFileSync(authPath, 'utf8')) as { token?: string };
  if (!auth.token) throw new Error('Vercel auth token missing');
  return auth.token;
}

function run(cmd: string, args: string[], opts?: { env?: NodeJS.ProcessEnv }): string {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
    env: { ...process.env, CI: 'false', ...(opts?.env || {}) },
  });
  if (r.status !== 0) {
    throw new Error(`Failed: ${cmd} ${args.join(' ')}\n${(r.stderr || r.stdout || '').slice(0, 500)}`);
  }
  return (r.stdout || '').trim();
}

async function api(token: string, method: string, urlPath: string, body?: unknown) {
  const url = new URL(`https://api.vercel.com${urlPath}`);
  if (!url.searchParams.has('teamId')) url.searchParams.set('teamId', TEAM_ID);
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function ensureEnv(token: string, projectId: string, key: string, value: string) {
  const listed = await api(token, 'GET', `/v9/projects/${projectId}/env`);
  for (const e of listed.json.envs || []) {
    if (e.key === key) {
      await api(token, 'DELETE', `/v9/projects/${projectId}/env/${e.id}`);
    }
  }
  const { status, json } = await api(token, 'POST', `/v10/projects/${projectId}/env`, {
    key,
    value,
    type: 'encrypted',
    target: ['production', 'preview', 'development'],
  });
  if (status >= 400) throw new Error(`env ${key} failed: ${status} ${JSON.stringify(json).slice(0, 200)}`);
  console.log(`[env] ${key} set`);
}

function neonConnectionUri(): string {
  // Prefer pooled URI for serverless
  const out = run('npx', [
    '--yes',
    'neonctl',
    'connection-string',
    '--project-id',
    NEON_PROJECT_ID,
    '--org-id',
    NEON_ORG,
    '--pooled',
    '--prisma',
  ]);
  const uri = out.split(/\r?\n/).filter(Boolean).pop() || '';
  if (!uri.startsWith('postgres')) throw new Error('neonctl did not return a connection string');
  return uri;
}

async function main() {
  console.log('[1] Fetching Neon pooled connection string…');
  const databaseUrl = neonConnectionUri();
  console.log('[1] DATABASE_URL acquired (not printed)');

  console.log('[2] Pushing Prisma schema + seed to Neon…');
  run('npx', ['prisma', 'db', 'push', '--schema=apps/api/prisma/schema.prisma', '--accept-data-loss', '--skip-generate'], {
    env: { DATABASE_URL: databaseUrl },
  });
  // Resilient generate (Windows may lock query engine DLL)
  try {
    run('npx', ['tsx', 'scripts/prisma-generate-api.ts'], {
      env: { DATABASE_URL: databaseUrl },
    });
  } catch (e) {
    console.warn('[2] Prisma generate warning (continuing if client exists):', e instanceof Error ? e.message.slice(0, 120) : e);
  }
  run('npm', ['run', 'db:seed', '--workspace=@rss/api'], {
    env: {
      DATABASE_URL: databaseUrl,
      JWT_SECRET: 'rss-erp-jwt-secret-dev-change-in-production-32chars',
      JWT_REFRESH_SECRET: 'rss-erp-refresh-secret-dev-change-in-prod-32',
    },
  });
  console.log('[2] Schema pushed and seeded');

  const token = loadAuthToken();
  const jwtSecret = crypto.randomBytes(48).toString('hex');
  const jwtRefresh = crypto.randomBytes(48).toString('hex');

  console.log('[3] Ensuring raidzia-backend Vercel project…');
  const projects = await api(token, 'GET', '/v9/projects');
  let backendId = (projects.json.projects || []).find((p: any) => p.name === 'raidzia-backend')?.id;
  if (!backendId) {
    const created = await api(token, 'POST', '/v10/projects', {
      name: 'raidzia-backend',
      framework: null,
      rootDirectory: 'apps/api',
      buildCommand: 'cd ../.. && npm run build:api',
      installCommand: 'cd ../.. && npm install',
    });
    if (created.status >= 400) throw new Error(JSON.stringify(created.json).slice(0, 400));
    backendId = created.json.id;
  }
  await api(token, 'PATCH', `/v9/projects/${backendId}`, {
    rootDirectory: 'apps/api',
    framework: null,
    installCommand: 'cd ../.. && npm install',
    buildCommand: 'cd ../.. && npm run build:api',
    sourceFilesOutsideRootDirectory: true,
  });

  console.log('[4] Setting backend env…');
  await ensureEnv(token, backendId, 'DATABASE_URL', databaseUrl);
  await ensureEnv(token, backendId, 'JWT_SECRET', jwtSecret);
  await ensureEnv(token, backendId, 'JWT_REFRESH_SECRET', jwtRefresh);
  await ensureEnv(token, backendId, 'NODE_ENV', 'production');
  await ensureEnv(token, backendId, 'TRUST_PROXY', '1');
  await ensureEnv(token, backendId, 'CORS_ORIGINS', FRONTEND_ORIGINS);
  await ensureEnv(token, backendId, 'CORS_ALLOW_DEPLOY_PREVIEWS', 'true');
  await ensureEnv(token, backendId, 'SKIP_API_LISTEN', '1');
  await ensureEnv(token, backendId, 'VERCEL', '1');

  const apiUrl = 'https://raidzia-backend.vercel.app/api';
  console.log(`[5] Setting frontend NEXT_PUBLIC_API_URL=${apiUrl}`);
  await ensureEnv(token, FRONTEND_PROJECT_ID, 'NEXT_PUBLIC_API_URL', apiUrl);
  await ensureEnv(token, FRONTEND_PROJECT_ID, 'NEXT_PUBLIC_APP_URL', 'https://raidzia-api.vercel.app');
  // Also store DB on frontend project for future (not required for Next)
  await ensureEnv(token, FRONTEND_PROJECT_ID, 'DATABASE_URL', databaseUrl);

  console.log('[6] Creating production deployments…');
  const backendDeploy = await api(token, 'POST', '/v13/deployments', {
    name: 'raidzia-backend',
    project: backendId,
    target: 'production',
    gitSource: { type: 'github', org: 'mannanjr-755', repo: 'Raidzia', ref: 'main' },
    projectSettings: {
      framework: null,
      rootDirectory: 'apps/api',
      installCommand: 'cd ../.. && npm install',
      buildCommand: 'cd ../.. && npm run build:api',
      sourceFilesOutsideRootDirectory: true,
    },
  });
  const frontendDeploy = await api(token, 'POST', '/v13/deployments', {
    name: 'raidzia-api',
    project: FRONTEND_PROJECT_ID,
    target: 'production',
    gitSource: { type: 'github', org: 'mannanjr-755', repo: 'Raidzia', ref: 'main' },
  });

  const summary = {
    apiUrl,
    frontendUrl: 'https://raidzia-api.vercel.app',
    neonProjectId: NEON_PROJECT_ID,
    backendProjectId: backendId,
    backendDeployStatus: backendDeploy.status,
    backendDeployId: backendDeploy.json.id || backendDeploy.json.error || null,
    frontendDeployStatus: frontendDeploy.status,
    frontendDeployId: frontendDeploy.json.id || frontendDeploy.json.error || null,
  };
  fs.writeFileSync(path.join(ROOT, '.vercel-api-wire.json'), JSON.stringify(summary, null, 2));
  console.log('[done]');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
