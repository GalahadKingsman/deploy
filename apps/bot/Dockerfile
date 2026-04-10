# Monorepo: build bot (bundles shared sources in dist); polling — no public URL
FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/
COPY apps/bot/package.json apps/bot/tsconfig.json ./apps/bot/

RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/bot ./apps/bot

RUN pnpm --filter @tracked/bot build

ENV NODE_ENV=production

WORKDIR /app/apps/bot

# npm script uses ../../.env; в Docker переменные задаёт compose — без .env
CMD ["node", "dist/apps/bot/src/index.js"]
