/**
 * Deploy Express API to Vercel (serverless) and wire the frontend env.
 * Does not print secret values.
 */
import { spawnSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

const ROOT = path.resolve(__dirname, '..');
const TEAM = 'abdulmannans-projects-6f82c578';
const TEAM_ID = 'team_EGuL8sb47Ni8qSAC2sCvEHGK';
const FRONTEND_PROJECT_ID = 'prj_Jt4NPv1m2awWnCTcYi8GuhVGMMcJ'; // raidzia-api (Next.js)
const FRONTEND_ORIGINS = [
  'https://raidzia-api.vercel.app',
  'https://raidzia-api-abdulmannans-projects-6f82c578.vercel.app',
  'https://raidzia.vercel.app',
  'https://raidzia-abdulmannans-projects-6f82c578.vercel.app',
].join(',');

function loadAuthToken(): string {
  const authPath = path.join(
    process.env.APPDATA || '',
    'xdg.data',
    'com.vercel.cli',
    'auth.json'
  );
  const auth = JSON.parse(fs.readFileSync(authPath, 'utf8')) as { token?: string };
  if (!auth.token) throw new Error('Vercel auth token not found — run: npx vercel login');
  return auth.token;
}

async function api(
  token: string,
  method: string,
  urlPath: string,
  body?: unknown
): Promise<{ status: number; json: any }> {
  const url = new URL(`https://api.vercel.com${urlPath}`);
  if (!url.searchParams.has('teamId')) url.searchParams.set('teamId', TEAM_ID);
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function parseEnvFile(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    // Vercel env pull sometimes wraps in quotes and escapes
    val = val.replace(/\\n/g, '\n').replace(/\\"/g, '"');
    out[key] = val;
  }
  return out;
}

function run(cmd: string, args: string[], opts?: { cwd?: string; input?: string }) {
  const r = spawnSync(cmd, args, {
    cwd: opts?.cwd || ROOT,
    encoding: 'utf8',
    shell: true,
    input: opts?.input,
    env: process.env,
  });
  if (r.status !== 0) {
    const err = (r.stderr || r.stdout || '').slice(0, 800);
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}\n${err}`);
  }
  return r.stdout || '';
}

function classifyDb(url: string): { ok: boolean; local: boolean; hint: string } {
  try {
    const host = new URL(url.replace(/^postgresql:/i, 'http:').replace(/^postgres:/i, 'http:'))
      .hostname;
    const local = host === 'localhost' || host === '127.0.0.1';
    const parts = host.split('.');
    return { ok: true, local, hint: parts.length >= 2 ? parts.slice(-2).join('.') : host };
  } catch {
    return { ok: false, local: true, hint: 'unparseable' };
  }
}

async function ensureEnv(
  token: string,
  projectId: string,
  key: string,
  value: string,
  targets: string[] = ['production', 'preview', 'development']
) {
  // Remove existing (ignore errors)
  await api(token, 'GET', `/v9/projects/${projectId}/env`);
  const listed = await api(token, 'GET', `/v9/projects/${projectId}/env`);
  const existing = (listed.json.envs || []).filter((e: any) => e.key === key);
  for (const e of existing) {
    await api(token, 'DELETE', `/v9/projects/${projectId}/env/${e.id}`);
  }
  const { status, json } = await api(token, 'POST', `/v10/projects/${projectId}/env`, {
    key,
    value,
    type: 'encrypted',
    target: targets,
  });
  if (status >= 400) {
    throw new Error(`Failed to set ${key}: ${status} ${JSON.stringify(json).slice(0, 200)}`);
  }
  console.log(`[env] set ${key} on ${projectId}`);
}

async function main() {
  const token = loadAuthToken();
  console.log('[1] Pulling frontend production env (secrets not printed)…');
  const tmpEnv = path.join(ROOT, '.env.vercel.pull.tmp');
  run('npx', [
    'vercel',
    'env',
    'pull',
    tmpEnv,
    '--environment=production',
    `--scope=${TEAM}`,
    '--yes',
  ]);
  const env = parseEnvFile(tmpEnv);
  try {
    fs.unlinkSync(tmpEnv);
  } catch {
    /* ignore */
  }

  const databaseUrl = env.DATABASE_URL || '';
  const db = classifyDb(databaseUrl);
  console.log(`[1] DATABASE_URL present=${Boolean(databaseUrl)} parse_ok=${db.ok} local=${db.local} hint=${db.hint}`);
  if (!databaseUrl || !db.ok) {
    throw new Error('DATABASE_URL missing or unparseable on Vercel project. Add a hosted Postgres URL first.');
  }
  if (db.local) {
    throw new Error(
      'DATABASE_URL points to localhost — cloud API cannot use it. Provision Neon/Supabase/Railway Postgres and set DATABASE_URL on Vercel.'
    );
  }

  const jwtSecret =
    env.JWT_SECRET || crypto.randomBytes(32).toString('hex') + crypto.randomBytes(8).toString('hex');
  const jwtRefresh =
    env.JWT_REFRESH_SECRET ||
    crypto.randomBytes(32).toString('hex') + crypto.randomBytes(8).toString('hex');

  console.log('[2] Ensuring backend project raidzia-backend…');
  let backendId = '';
  const projects = await api(token, 'GET', '/v9/projects');
  const found = (projects.json.projects || []).find((p: any) => p.name === 'raidzia-backend');
  if (found) {
    backendId = found.id;
    console.log(`[2] Using existing project ${backendId}`);
  } else {
    const created = await api(token, 'POST', '/v10/projects', {
      name: 'raidzia-backend',
      framework: null,
      rootDirectory: 'apps/api',
      buildCommand: 'cd ../.. && npm run build:api',
      installCommand: 'cd ../.. && npm install',
      serverlessFunctionRegion: 'iad1',
    });
    if (created.status >= 400) {
      throw new Error(`Create project failed: ${JSON.stringify(created.json).slice(0, 400)}`);
    }
    backendId = created.json.id;
    console.log(`[2] Created project ${backendId}`);
  }

  // Ensure root directory / build settings
  await api(token, 'PATCH', `/v9/projects/${backendId}`, {
    rootDirectory: 'apps/api',
    framework: null,
    installCommand: 'cd ../.. && npm install',
    buildCommand: 'cd ../.. && npm run build:api',
    sourceFilesOutsideRootDirectory: true,
  });

  console.log('[3] Setting backend env…');
  await ensureEnv(token, backendId, 'DATABASE_URL', databaseUrl);
  await ensureEnv(token, backendId, 'JWT_SECRET', jwtSecret);
  await ensureEnv(token, backendId, 'JWT_REFRESH_SECRET', jwtRefresh);
  await ensureEnv(token, backendId, 'NODE_ENV', 'production');
  await ensureEnv(token, backendId, 'TRUST_PROXY', '1');
  await ensureEnv(token, backendId, 'CORS_ORIGINS', FRONTEND_ORIGINS);
  await ensureEnv(token, backendId, 'CORS_ALLOW_DEPLOY_PREVIEWS', 'true');
  await ensureEnv(token, backendId, 'SKIP_API_LISTEN', '1');

  console.log('[4] Linking git and creating deployment from GitHub main…');
  // Connect git if needed — use deployment from existing repo
  const deploy = await api(token, 'POST', '/v13/deployments', {
    name: 'raidzia-backend',
    project: backendId,
    target: 'production',
    gitSource: {
      type: 'github',
      repo: 'mannanjr-755/Raidzia',
      ref: 'main',
      org: 'mannanjr-755',
    },
    projectSettings: {
      framework: null,
      rootDirectory: 'apps/api',
      installCommand: 'cd ../.. && npm install',
      buildCommand: 'cd ../.. && npm run build:api',
      sourceFilesOutsideRootDirectory: true,
    },
  });

  if (deploy.status >= 400) {
    console.log('[4] Git deploy failed, will try CLI deploy after commit…');
    console.log(JSON.stringify(deploy.json).slice(0, 400));
  } else {
    console.log(`[4] Deployment created: ${deploy.json.id} url=${deploy.json.url || ''}`);
  }

  // Determine public API host (production alias)
  const backendHost = 'raidzia-backend.vercel.app';
  const apiUrl = `https://${backendHost}/api`;
  console.log(`[5] Setting frontend NEXT_PUBLIC_API_URL=${apiUrl}`);
  await ensureEnv(token, FRONTEND_PROJECT_ID, 'NEXT_PUBLIC_API_URL', apiUrl);
  await ensureEnv(token, FRONTEND_PROJECT_ID, 'NEXT_PUBLIC_APP_URL', 'https://raidzia-api.vercel.app');
  // Clear unconfigured flag is build-time only — redeploy handles it

  console.log('[6] Redeploying frontend from Git…');
  const feDeploy = await api(token, 'POST', '/v13/deployments', {
    name: 'raidzia-api',
    project: FRONTEND_PROJECT_ID,
    target: 'production',
    gitSource: {
      type: 'github',
      repo: 'mannanjr-755/Raidzia',
      ref: 'main',
      org: 'mannanjr-755',
    },
  });
  console.log(`[6] Frontend deploy: status=${feDeploy.status} id=${feDeploy.json.id || feDeploy.json.error || ''}`);

  // Write non-secret summary for follow-up
  const summary = {
    backendProjectId: backendId,
    apiUrl,
    frontendOrigins: FRONTEND_ORIGINS.split(','),
    dbHostHint: db.hint,
    backendDeployId: deploy.json.id || null,
    frontendDeployId: feDeploy.json.id || null,
  };
  fs.writeFileSync(path.join(ROOT, '.vercel-api-wire.json'), JSON.stringify(summary, null, 2));
  console.log('[done] Wrote .vercel-api-wire.json');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
