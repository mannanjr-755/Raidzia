/**
 * Recreate deleted raidzia-backend Vercel project and reconnect frontend.
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
const API_HOST = 'raidzia-backend.vercel.app';
const API_URL = `https://${API_HOST}/api`;
const FRONTEND_ORIGINS = [
  'https://raidzia-api.vercel.app',
  'https://raidzia-api-abdulmannans-projects-6f82c578.vercel.app',
  'https://raidzia.vercel.app',
  'https://raidzia-abdulmannans-projects-6f82c578.vercel.app',
].join(',');

function loadAuthToken(): string {
  const authPath = path.join(process.env.APPDATA || '', 'xdg.data', 'com.vercel.cli', 'auth.json');
  const auth = JSON.parse(fs.readFileSync(authPath, 'utf8')) as { token?: string };
  if (!auth.token) throw new Error('Vercel auth token missing — run npx vercel login');
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
    throw new Error(`Failed: ${cmd} ${args.join(' ')}\n${(r.stderr || r.stdout || '').slice(0, 600)}`);
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
    if (e.key === key) await api(token, 'DELETE', `/v9/projects/${projectId}/env/${e.id}`);
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

async function waitForReady(token: string, deploymentId: string, timeoutMs = 300_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { status, json } = await api(token, 'GET', `/v13/deployments/${deploymentId}`);
    const ready = json.readyState || json.status;
    console.log(`[deploy] ${deploymentId} → ${ready}`);
    if (ready === 'READY') return json;
    if (ready === 'ERROR' || ready === 'CANCELED') {
      throw new Error(`Deployment failed: ${ready}`);
    }
    await new Promise((r) => setTimeout(r, 8000));
  }
  throw new Error('Timed out waiting for deployment');
}

async function main() {
  const token = loadAuthToken();

  console.log('[1] Fetching Neon DATABASE_URL…');
  const databaseUrl = neonConnectionUri();
  console.log('[1] DATABASE_URL acquired (not printed)');

  console.log('[2] Ensuring Prisma schema on Neon (no data-loss push)…');
  try {
    run('npx', ['prisma', 'db', 'push', '--schema=apps/api/prisma/schema.prisma', '--skip-generate'], {
      env: { DATABASE_URL: databaseUrl },
    });
  } catch (e) {
    console.warn('[2] db push warning:', e instanceof Error ? e.message.slice(0, 200) : e);
  }

  console.log('[3] Creating/finding raidzia-backend project…');
  const projects = await api(token, 'GET', '/v9/projects');
  let backendId = (projects.json.projects || []).find((p: any) => p.name === 'raidzia-backend')?.id as
    | string
    | undefined;

  if (!backendId) {
    const created = await api(token, 'POST', '/v10/projects', {
      name: 'raidzia-backend',
      framework: null,
      gitRepository: {
        type: 'github',
        repo: 'mannanjr-755/Raidzia',
      },
    });
    if (created.status >= 400) {
      // Fallback without gitRepository link
      const created2 = await api(token, 'POST', '/v10/projects', {
        name: 'raidzia-backend',
        framework: null,
      });
      if (created2.status >= 400) {
        throw new Error(`Create project failed: ${JSON.stringify(created2.json).slice(0, 400)}`);
      }
      backendId = created2.json.id;
    } else {
      backendId = created.json.id;
    }
    console.log(`[3] Created project ${backendId}`);
  } else {
    console.log(`[3] Project already exists ${backendId}`);
  }

  await api(token, 'PATCH', `/v9/projects/${backendId}`, {
    rootDirectory: 'apps/api',
    framework: null,
    installCommand: 'cd ../.. && npm install --include=dev',
    buildCommand: 'cd ../.. && npm run build:api:vercel',
    sourceFilesOutsideRootDirectory: true,
    nodeVersion: '20.x',
  });

  const jwtSecret = crypto.randomBytes(48).toString('hex');
  const jwtRefresh = crypto.randomBytes(48).toString('hex');

  console.log('[4] Restoring environment variables…');
  await ensureEnv(token, backendId, 'DATABASE_URL', databaseUrl);
  await ensureEnv(token, backendId, 'JWT_SECRET', jwtSecret);
  await ensureEnv(token, backendId, 'JWT_REFRESH_SECRET', jwtRefresh);
  await ensureEnv(token, backendId, 'NODE_ENV', 'production');
  await ensureEnv(token, backendId, 'TRUST_PROXY', '1');
  await ensureEnv(token, backendId, 'CORS_ORIGINS', FRONTEND_ORIGINS);
  await ensureEnv(token, backendId, 'CORS_ALLOW_DEPLOY_PREVIEWS', 'true');
  await ensureEnv(token, backendId, 'SKIP_API_LISTEN', '1');
  await ensureEnv(token, backendId, 'VERCEL', '1');

  console.log('[5] Deploying from GitHub main…');
  const deploy = await api(token, 'POST', '/v13/deployments', {
    name: 'raidzia-backend',
    project: backendId,
    target: 'production',
    gitSource: { type: 'github', org: 'mannanjr-755', repo: 'Raidzia', ref: 'main' },
    projectSettings: {
      framework: null,
      rootDirectory: 'apps/api',
      installCommand: 'cd ../.. && npm install --include=dev',
      buildCommand: 'cd ../.. && npm run build:api:vercel',
      sourceFilesOutsideRootDirectory: true,
      nodeVersion: '20.x',
    },
  });
  if (deploy.status >= 400 || !deploy.json.id) {
    throw new Error(`Deploy create failed: ${JSON.stringify(deploy.json).slice(0, 500)}`);
  }
  console.log(`[5] Deployment ${deploy.json.id}`);
  await waitForReady(token, deploy.json.id);

  console.log('[6] Pointing frontend at API…');
  await ensureEnv(token, FRONTEND_PROJECT_ID, 'NEXT_PUBLIC_API_URL', API_URL);
  await ensureEnv(token, FRONTEND_PROJECT_ID, 'NEXT_PUBLIC_APP_URL', 'https://raidzia-api.vercel.app');

  const feDeploy = await api(token, 'POST', '/v13/deployments', {
    name: 'raidzia-api',
    project: FRONTEND_PROJECT_ID,
    target: 'production',
    gitSource: { type: 'github', org: 'mannanjr-755', repo: 'Raidzia', ref: 'main' },
  });
  if (feDeploy.json.id) {
    console.log(`[6] Frontend deploy ${feDeploy.json.id}`);
    try {
      await waitForReady(token, feDeploy.json.id);
    } catch (e) {
      console.warn('[6] Frontend wait:', e instanceof Error ? e.message : e);
    }
  }

  // Smoke tests
  console.log('[7] Smoke tests…');
  const healthRes = await fetch(`https://${API_HOST}/api/health`);
  const health = await healthRes.json().catch(() => ({}));
  console.log('[7] health', healthRes.status, health.database || health);

  const loginRes = await fetch(`https://${API_HOST}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://raidzia-api.vercel.app' },
    body: JSON.stringify({ email: 'admin@rssbuilders.com', password: 'Admin@123' }),
  });
  const login = await loginRes.json().catch(() => ({}));
  console.log('[7] login', loginRes.status, { success: login.success, hasToken: Boolean(login.data?.accessToken) });

  const summary = {
    restored: false,
    recreated: true,
    backendProjectId: backendId,
    apiUrl: API_URL,
    frontendUrl: 'https://raidzia-api.vercel.app',
    backendDeployId: deploy.json.id,
    frontendDeployId: feDeploy.json.id || null,
    healthOk: healthRes.status === 200 && health.database === 'connected',
    loginOk: loginRes.status === 200 && Boolean(login.data?.accessToken),
  };
  fs.writeFileSync(path.join(ROOT, '.vercel-api-wire.json'), JSON.stringify(summary, null, 2));
  console.log('[done]');
  console.log(JSON.stringify(summary, null, 2));

  if (!summary.healthOk || !summary.loginOk) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
