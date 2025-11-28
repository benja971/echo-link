FROM node:24-alpine@sha256:0f0b6ce0aa8e49ab9ad95d3b3c0c21f8e92febc6b3c9f1b8e0c0d0e0f0a0b0c AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependency files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies
RUN pnpm install --prod --frozen-lockfile

# Install dev dependencies for build
RUN pnpm install -D typescript @types/node @types/express @types/multer @types/pg @types/uuid

# Copy source and build backend
COPY tsconfig.json ./
COPY src ./src
RUN pnpm run build

# Copy frontend source and build it
COPY frontend/package.json ./frontend/
WORKDIR /app/frontend
RUN pnpm install
COPY frontend/tsconfig.json ./
COPY frontend/vite.config.ts ./
COPY frontend/index.html ./
COPY frontend/postcss.config.js ./
COPY frontend/tailwind.config.js ./
COPY frontend/components.json ./
COPY frontend/public ./public
COPY frontend/src ./src
RUN pnpm run build

# Switch back to app root
WORKDIR /app

FROM node:24-alpine@sha256:0f0b6ce0aa8e49ab9ad95d3b3c0c21f8e92febc6b3c9f1b8e0c0d0e0f0a0b0c

WORKDIR /app

# Install ffmpeg for video thumbnail generation
RUN apk add --no-cache ffmpeg

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/public ./public

# Copy migrations directory (needed at runtime) - directly from build context
COPY src/db/migrations ./dist/db/migrations

ENV NODE_ENV=production

USER node

EXPOSE 3000

CMD ["node", "dist/server.js"]
