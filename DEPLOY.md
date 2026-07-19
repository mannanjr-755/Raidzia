# Deploy on Netlify or Vercel (Frontend)

The Express API is best as a long-running service (Railway/Render/VPS). This project
also supports an API-only Vercel serverless deploy (`apps/api` → `raidzia-backend`).

## 1. Deploy the API (required)

```bash
npm ci
npm run build:api
npm run start:api
```

Or use `render.yaml` / `railway.toml` for full-stack on those hosts.

Set on the API host:

```
DATABASE_URL=...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
CORS_ORIGINS=https://YOUR-FRONTEND.netlify.app
```

Optional staging:

```
CORS_ALLOW_DEPLOY_PREVIEWS=true
```

(allows `*.netlify.app` and `*.vercel.app` HTTPS origins)
## 2. Deploy the frontend (Netlify)

1. Import the GitHub repo: `https://github.com/mannanjr-755/Raidzia`
2. **Package directory:** `apps/web`
3. **Base directory:** leave empty (repo root)
4. Build uses `netlify.toml` â†’ `npm run build:cdn`
5. Environment variable:

```
NEXT_PUBLIC_API_URL=https://YOUR-API-HOST/api
```

6. Deploy

## Production URLs (current)

- Frontend: `https://raidzia-api.vercel.app`
- API: `https://raidzia-backend.vercel.app/api`
- Database: Neon (`raidzia-erp`)

Required Vercel env on frontend: `NEXT_PUBLIC_API_URL=https://raidzia-backend.vercel.app/api`
Required API env: `CORS_ORIGINS` includes the frontend origin.

## 3. Deploy the frontend (Vercel)

The real Next.js app lives in `apps/web`. The repo root also has a legacy Next.js
tree (`next.config.ts` + `src/`), so **Root Directory must be configured correctly**.

### Recommended (Root Directory = `apps/web`)

1. Import the same repo on Vercel
2. **Root Directory:** `apps/web` (Project Settings â†’ General)
3. Enable **Include source files outside of the Root Directory**
4. Install / Build come from `apps/web/vercel.json` (`cd ../.. && npm install` / `build:cdn`)
5. Environment variable:

```
NEXT_PUBLIC_API_URL=https://YOUR-API-HOST/api
```

6. Deploy

### Alternative (Root Directory = repository root)

`vercel.json` at the repo root runs `npm run build:vercel`, which builds `apps/web`
then stages `apps/web/.next` â†’ `./.next` so Vercelâ€™s Next.js preset finds the output.

Still set:

```
NEXT_PUBLIC_API_URL=https://YOUR-API-HOST/api
```

**Never** set `API_ORIGIN=http://127.0.0.1:4000` on Vercel (causes `DNS_HOSTNAME_RESOLVED_PRIVATE`).

## Why this setup?

Netlify/Vercel edge networks block proxies to `127.0.0.1` / `localhost` with:

```
DNS_HOSTNAME_RESOLVED_PRIVATE
```

The CDN build never embeds private rewrites. The browser calls your public API URL directly.

## Full-stack alternative (recommended)

Use Railway or Render with:

```bash
npm run build   # API + Web together
npm start
```

See `railway.toml` and `render.yaml`.

