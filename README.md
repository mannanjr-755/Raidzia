# RSS Construction ERP

Construction ERP for **Rehan Shahid & Sons Builders & Developers**.

Monorepo with:

- **`apps/web`** — Next.js frontend (port 3000)
- **`apps/api`** — Express API (port 4000)
- **`packages/shared`** — Shared types and RBAC

## Requirements

- Node.js 20+
- PostgreSQL

## Local development

```bash
npm install
npm run dev
```

Starts PostgreSQL (embedded on port 5433), API, and web app.

Default admin (after seed): `admin@rssbuilders.com` / `Admin@123`

## Production build

```bash
npm run build
npm start
```

## Deployment

| Target | Command / config |
|--------|------------------|
| Full stack (VPS / Docker) | `npm run build` then `npm start`, or `docker compose up -d --build` |
| Netlify (frontend only) | `netlify.toml` — set `API_ORIGIN` to your external API URL |
| API only | `npm run build:api` then `npm run start:api` — see `render.yaml` |

Copy `.env.example` to `.env` and set `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `CORS_ORIGINS`.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Dev: DB + API + web |
| `npm run build` | Build shared, API, and web |
| `npm run build:netlify` | Frontend build for Netlify |
| `npm run start` | Production: API + web |

## License

Private — Rehan Shahid & Sons Builders & Developers
