# apps/web — SvelteKit single app on Bun runtime
FROM oven/bun:1.3-alpine AS build
WORKDIR /app

# Install workspace deps. Single stage so bun's per-workspace .bin/
# symlinks (vite, svelte-kit, drizzle-kit) survive into the build step;
# splitting deps + build and only COPY-ing /app/node_modules drops the
# workspace-level binaries and breaks `bun --filter web build`.
COPY package.json bun.lock ./
COPY apps/web/package.json ./apps/web/
COPY apps/bot/package.json ./apps/bot/
COPY packages/db/package.json ./packages/db/
RUN bun install --frozen-lockfile

COPY . .
RUN bun --filter web build

FROM oven/bun:1.3-alpine AS runtime
RUN apk add --no-cache ffmpeg
WORKDIR /app

# Bun uses an isolated node_modules layout (similar to pnpm): real
# packages live under /app/node_modules/.bun/<pkg>@<ver>/ and each
# workspace has its own node_modules/ with symlinks to those targets.
# At runtime the SvelteKit build resolves bare imports (zod, resend,
# drizzle-orm) by walking up from /app/apps/web/build/ — so we MUST
# preserve the per-workspace symlinks AND the .bun/ store. Copying
# /app wholesale is the simplest correct path; image stays modest.
COPY --from=build /app /app

# Drizzle migrations are at /app/packages/db/migrations and the
# deploy.sh runs them via `bun src/migrate.ts` from packages/db.

EXPOSE 3000
ENV PORT=3000 HOST=0.0.0.0 NODE_ENV=production
CMD ["bun", "apps/web/build/index.js"]
