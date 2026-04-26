#!/bin/bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🚀 Echo Link Deployment Script (v2 — bun + svelteKit)${NC}"
echo ""

if [ "$EUID" -ne 0 ]; then
  echo -e "${YELLOW}⚠️  Not running as root. Some operations may require sudo.${NC}"
fi

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed.${NC}"
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose v2 plugin is not installed.${NC}"
    exit 1
fi

if ! docker network ls | grep -q infra-net; then
    echo -e "${YELLOW}⚠️  Network 'infra-net' does not exist. Creating it...${NC}"
    docker network create infra-net
    echo -e "${GREEN}✅ Network 'infra-net' created.${NC}"
fi

if [ ! -f .env.production ]; then
    echo -e "${RED}❌ .env.production not found. Copy .env.production.example and fill it.${NC}"
    exit 1
fi

# Verify the new v2 vars are present (zod will refuse to start without them)
required=(SESSION_SECRET ANONYMOUS_IP_SALT RESEND_API_KEY EMAIL_FROM PUBLIC_BASE_URL CDN_PUBLIC_BASE_URL)
missing=()
for var in "${required[@]}"; do
    if ! grep -q "^${var}=" .env.production || grep -q "^${var}=$" .env.production; then
        missing+=("$var")
    fi
done
if [ ${#missing[@]} -ne 0 ]; then
    echo -e "${RED}❌ .env.production is missing required v2 vars: ${missing[*]}${NC}"
    echo -e "${YELLOW}   See .env.production.example for the full list.${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}📥 Pulling latest changes from git...${NC}"
git pull

echo ""
echo -e "${GREEN}📦 Building Docker images (bun + svelteKit + ffmpeg)...${NC}"
docker compose -f docker-compose.prod.yml build --no-cache

echo ""
echo -e "${YELLOW}📜 Applying database migrations...${NC}"
# Run drizzle migrations from inside a one-shot container so we don't need
# bun installed on the host. The web image bundles packages/db at runtime.
docker compose -f docker-compose.prod.yml run --rm \
    --entrypoint sh web \
    -c 'cd packages/db && bun src/migrate.ts' || {
    echo -e "${RED}❌ Migration failed. Aborting deploy.${NC}"
    exit 1
}

echo ""
echo -e "${GREEN}🚀 Starting services...${NC}"
docker compose -f docker-compose.prod.yml up -d

echo ""
echo -e "${GREEN}⏳ Waiting for services to be healthy...${NC}"
sleep 12

if curl -f -s http://localhost:3002/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Echo Link v2 is running!${NC}"
    echo ""
    echo "Services:"
    echo "  - web:  http://localhost:3002 (SvelteKit + Bun)"
    echo "  - bot:  Discord bot (logs via 'docker compose logs -f bot')"
    echo ""
    echo "Logs: docker compose -f docker-compose.prod.yml logs -f"
else
    echo -e "${RED}❌ Health check failed. Check logs:${NC}"
    echo "  docker compose -f docker-compose.prod.yml logs --tail 80"
    exit 1
fi
