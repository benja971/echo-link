#!/bin/bash

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Echo Link Deployment Script${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${YELLOW}⚠️  Not running as root. Some operations may require sudo.${NC}"
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

# Check if infra-net exists
if ! docker network ls | grep -q infra-net; then
    echo -e "${YELLOW}⚠️  Network 'infra-net' does not exist. Creating it...${NC}"
    docker network create infra-net
    echo -e "${GREEN}✅ Network 'infra-net' created.${NC}"
fi

echo ""
echo -e "${GREEN}📦 Building Docker images...${NC}"
docker-compose -f docker-compose.prod.yml build

echo ""
echo -e "${GREEN}🚀 Starting services...${NC}"
docker-compose -f docker-compose.prod.yml up -d

echo ""
echo -e "${GREEN}⏳ Waiting for services to be healthy...${NC}"
sleep 10

# Check health
if curl -f -s http://localhost:3002/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Echo Link is running!${NC}"
    echo ""
    echo -e "${GREEN}🎉 Deployment successful!${NC}"
    echo ""
    echo "Services:"
    echo "  - Echo Link: http://localhost:3002 (mapped to port 3002)"
    echo "  - MinIO API: http://localhost:9002 (mapped to port 9002)"
    echo "  - MinIO Console: http://localhost:9003 (mapped to port 9003)"
    echo ""
    echo "Next steps:"
    echo "  1. Configure your reverse proxy (Caddy/Nginx) to point to these ports"
    echo "  2. Test: curl http://localhost:3002/health"
    echo "  3. View logs: docker-compose -f docker-compose.prod.yml logs -f"
    echo ""
    echo "📖 Full documentation: DEPLOYMENT.md"
else
    echo -e "${RED}❌ Health check failed. Check logs:${NC}"
    echo "  docker-compose -f docker-compose.prod.yml logs"
    exit 1
fi
