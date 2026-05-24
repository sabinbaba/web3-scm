#!/bin/bash
# Reset the full local Bralirwa SCM Docker stack and remove local ledger/app data.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
NETWORK_DIR="$ROOT_DIR/beer-network"

cd "$NETWORK_DIR"

echo "Stopping and removing Compose services, networks, and volumes..."
docker compose down -v --remove-orphans

echo "Removing Fabric chaincode containers..."
docker rm -f $(docker ps -aq --filter "name=dev-peer") 2>/dev/null || true

echo "Removing Fabric chaincode images..."
docker rmi -f $(docker images -q --filter "reference=dev-peer*") 2>/dev/null || true

echo "Reset complete"
echo "Start fresh with: ./start-project.sh"
