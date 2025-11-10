FROM node:24-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependency files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies
RUN pnpm install --prod --frozen-lockfile

# Install dev dependencies for build
RUN pnpm install -D typescript @types/node @types/express @types/multer @types/pg @types/uuid

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
RUN pnpm run build

FROM node:24-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY public ./public

# Copy migrations directory (needed at runtime)
COPY --from=builder /app/src/db/migrations ./dist/db/migrations

ENV NODE_ENV=production

USER node

EXPOSE 3000

CMD ["node", "dist/server.js"]
