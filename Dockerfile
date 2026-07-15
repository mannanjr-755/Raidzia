# RSS Construction ERP — single image running API + Web together
# Build:  docker build -t rss-erp .
# Run:    docker run --env-file .env -p 3000:3000 -p 4000:4000 rss-erp
#
# For separate containers, use docker-compose.yml (Dockerfile.api + Dockerfile.web).

FROM node:20-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/prisma ./apps/api/prisma
COPY prisma ./prisma
RUN npm ci

FROM deps AS build
COPY . .
ARG API_ORIGIN=http://127.0.0.1:4000
ENV API_ORIGIN=$API_ORIGIN
ENV NEXT_PUBLIC_API_URL=/api
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps ./apps
COPY --from=build /app/packages ./packages
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/prisma ./prisma

EXPOSE 3000 4000

ENV API_PORT=4000
ENV WEB_PORT=3000
ENV API_ORIGIN=http://127.0.0.1:4000
ENV NEXT_PUBLIC_API_URL=/api

CMD ["npx", "tsx", "scripts/run-prod.ts"]
