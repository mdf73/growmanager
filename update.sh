#!/bin/bash
# GrowManager — Script de mise à jour production Linux
# Usage : ./update.sh
# À lancer depuis le dossier du projet après chaque push Windows

set -e

echo ""
echo "=== GrowManager — Mise à jour production ==="
echo ""

echo "[1/3] Pull des derniers commits..."
git pull

echo ""
echo "[2/3] Rebuild des images Docker et redémarrage..."
docker compose -f docker-compose.server.yml up -d --build

echo ""
echo "[3/3] Vérification des conteneurs..."
docker compose -f docker-compose.server.yml ps

echo ""
echo "=== Mise à jour terminée ! ==="
echo ""
