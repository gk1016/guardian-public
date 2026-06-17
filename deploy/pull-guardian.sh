#!/usr/bin/env bash
# pull-guardian.sh — deploy guardian-engine to PROD by PULLING the CI-built image.
#
# Images are built and pushed to Docker Hub by GitHub Actions
# (.github/workflows/ci.yml) on merge to main. nucbox only pulls + runs; it does
# NOT build. The data volumes (postgres, certs, ship-images, backups) are
# preserved across deploys.
#
# Usage:  ./deploy/pull-guardian.sh [TAG]   (TAG defaults to 'latest', e.g. git-<sha>)
# Env:    DEPLOY_DIR (default: parent dir of this script)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="${DEPLOY_DIR:-$(dirname "$SCRIPT_DIR")}"
export GUARDIAN_TAG="${1:-latest}"

echo "==> PROD (${DEPLOY_DIR}) pull + up  :${GUARDIAN_TAG}"
( cd "$DEPLOY_DIR" && docker compose pull guardian-engine && docker compose up -d guardian-engine )

echo "==> Health (internal :3420/health, start period ~10s)"
ok=0
for i in $(seq 1 12); do
  sleep 5
  if curl -sf http://127.0.0.1:3420/health >/dev/null 2>&1; then ok=1; break; fi
  echo "   ...waiting ($((i*5))s)"
done
if [ "$ok" = 1 ]; then
  IMG="$(docker inspect guardian-engine --format '{{.Image}}')"
  echo "==> PROD healthy on guardian-engine:${GUARDIAN_TAG} (${IMG#sha256:})"
else
  echo "==> PROD UNHEALTHY — check: docker logs --tail 40 guardian-engine"; exit 1
fi
