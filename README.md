# RSS Construction ERP

Construction ERP for **Rehan Shahid & Sons Builders & Developers**.

## Architecture

| Package | Role | Port |
|---------|------|------|
| `apps/web` | Next.js frontend | 3000 |
| `apps/api` | Express API | 4000 |
| `packages/shared` | Shared types & RBAC | — |

## Quick start (local)

```bash
npm install
npm run dev
```

Default admin (after seed): `admin@rssbuilders.com` / `Admin@123`

## Production deploy (API + Web together)

**Always use these commands** so both services deploy together:

```bash
npm ci
npm run build
npm start
```

This runs `scripts/run-prod.ts` which starts the API, waits for health check, then starts the web app.

### Supported platforms

| Platform | Config file | Notes |
|----------|-------------|-------|
| **Railway** | `railway.toml` | Full stack — `npm run build` + `npm start` |
| **Render** | `render.yaml` | Full stack — single web service |
| **Docker** | `Dockerfile` | `docker compose up -d --build app` |
| Netlify / Vercel | `netlify.toml` / `vercel.json` | **Frontend only** — API must be hosted separately |

### Required environment variables

```env
DATABASE_URL=postgresql://...
JWT_SECRET=<32+ chars>
JWT_REFRESH_SECRET=<different 32+ chars>
CORS_ORIGINS=https://your-domain.com
API_ORIGIN=http://127.0.0.1:4000
NEXT_PUBLIC_API_URL=/api
```

Copy `.env.example` for the full list.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Local dev: DB + API + web |
| `npm run build` | Build shared + API + web |
| `npm start` | Production: API + web together |
| `npm run verify:build` | Check build outputs exist |

## License

Private — Rehan Shahid & Sons Builders & Developers
