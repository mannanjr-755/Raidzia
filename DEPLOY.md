# Deploy on Netlify or Vercel (Frontend)

The Express API (`apps/api`) **cannot** run on Netlify or Vercel. Deploy it on Railway, Render, or a VPS, then connect the frontend.

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
4. Build uses `netlify.toml` → `npm run build:cdn`
5. Environment variable:

```
NEXT_PUBLIC_API_URL=https://YOUR-API-HOST/api
```

6. Deploy

## 3. Deploy the frontend (Vercel)

1. Import the same repo
2. Root Directory: leave as repo root (or configure monorepo root)
3. Build Command: `npm run build:cdn`
4. Environment variable:

```
NEXT_PUBLIC_API_URL=https://YOUR-API-HOST/api
```

5. Deploy

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
