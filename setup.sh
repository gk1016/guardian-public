#!/usr/bin/env bash
set -e

echo ""
echo "  Guardian Flight — Setup"
echo "  ─────────────────────────"
echo ""

# Check for Docker
if ! command -v docker &> /dev/null; then
  echo "  ERROR: Docker is not installed."
  echo "  Install Docker Desktop from https://www.docker.com/get-started/"
  exit 1
fi

if ! docker info &> /dev/null; then
  echo "  ERROR: Docker is not running."
  echo "  Start Docker Desktop and try again."
  exit 1
fi

# Generate .env if it doesn't exist
if [ -f .env ]; then
  echo "  Found existing .env — keeping current configuration."
else
  echo "  Generating configuration..."

  AUTH_SECRET=$(openssl rand -hex 32)
  PG_PASS=$(openssl rand -hex 16)

  cat > .env << ENV_EOF
DATABASE_URL=postgresql://guardian:${PG_PASS}@guardian-postgres:5432/guardian
POSTGRES_USER=guardian
POSTGRES_PASSWORD=${PG_PASS}
POSTGRES_DB=guardian
PORT=3000
NODE_ENV=production
AUTH_SECRET=${AUTH_SECRET}
SITE_ADDRESS=localhost
HTTPS_PORT=443
BACKUP_INTERVAL_HOURS=24
BACKUP_RETENTION_DAYS=7
ENV_EOF

  echo "  Configuration generated."
fi

echo ""
echo "  Pulling container images..."
docker compose pull

echo ""
echo "  Initializing database..."
docker compose --profile init run --rm guardian-init

echo ""
echo "  Starting Guardian..."
docker compose up -d

echo ""
echo "  ─────────────────────────"
echo "  Guardian is running."
echo ""
echo "  Open https://localhost in your browser."
echo "  (Accept the self-signed certificate warning — you're connecting to your own machine.)"
echo ""
echo "  The setup wizard will walk you through creating"
echo "  your organization and admin account."
echo "  ─────────────────────────"
echo ""
