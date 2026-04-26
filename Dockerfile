# apps/web — SvelteKit single app on Bun runtime
FROM oven/bun:1.3-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/web/package.json ./apps/web/
COPY apps/bot/package.json ./apps/bot/
COPY packages/db/package.json ./packages/db/
RUN bun install --frozen-lockfile

FROM oven/bun:1.3-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun --filter web build

FROM oven/bun:1.3-alpine AS runtime
RUN apk add --no-cache ffmpeg
WORKDIR /app

# SvelteKit Node adapter output
COPY --from=build /app/apps/web/build ./build
COPY --from=build /app/apps/web/package.json ./apps/web/package.json

# Workspace deps + drizzle migrations needed at runtime
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/db ./packages/db
COPY --from=build /app/package.json ./package.json

EXPOSE 3000
ENV PORT=3000 HOST=0.0.0.0 NODE_ENV=production
CMD ["bun", "build/index.js"]
