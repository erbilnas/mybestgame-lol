# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
RUN apk add --no-cache python3 make g++
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.22.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:22-alpine AS production
RUN apk add --no-cache python3 make g++
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.22.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/.output ./.output

# Coolify: mount a persistent volume at /app/data for SQLite
RUN mkdir -p /app/data

ENV NODE_ENV=production \
  HOST=0.0.0.0 \
  NITRO_HOST=0.0.0.0 \
  PORT=3000 \
  NITRO_PORT=3000 \
  NUXT_DATABASE_URL=./data/mybestgame.db

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
