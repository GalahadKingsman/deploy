# Monorepo: build @tracked/shared + @tracked/api; run from apps/api
FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl libreoffice \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/
COPY apps/api/package.json apps/api/tsconfig.json ./apps/api/

RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
COPY infra/migrations ./infra/migrations

RUN pnpm --filter @tracked/shared build && pnpm --filter @tracked/api build

ENV NODE_ENV=production
# Compiled layout: apps/api/dist/apps/api/src/main.js
ENV MIGRATIONS_DIR=/app/infra/migrations

WORKDIR /app/apps/api

EXPOSE 3001

CMD ["node", "dist/apps/api/src/main.js"]
