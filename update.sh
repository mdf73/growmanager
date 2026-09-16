#!/bin/bash
# update.sh — Met à jour GrowManager vers une version donnée
# Usage : ./update.sh v1.2.0
#         ./update.sh latest

set -e

VERSION=${1:-latest}
echo "🌱 Mise à jour GrowManager → ${VERSION}"

export GROWMANAGER_VERSION=${VERSION}

# Pull des nouvelles images
docker compose -f docker-compose.prod.yml pull backend frontend mcp-server

# Redémarrage des services (la DB n'est pas redémarrée)
docker compose -f docker-compose.prod.yml up -d --no-deps backend frontend mcp-server

echo "✅ GrowManager ${VERSION} déployé"
echo "   Backend    : $(docker inspect --format='{{.Config.Image}}' growmanager-backend 2>/dev/null || echo 'N/A')"
echo "   Frontend   : $(docker inspect --format='{{.Config.Image}}' growmanager-frontend 2>/dev/null || echo 'N/A')"
echo "   MCP server : $(docker inspect --format='{{.Config.Image}}' growmanager-mcp-server 2>/dev/null || echo 'N/A')"
