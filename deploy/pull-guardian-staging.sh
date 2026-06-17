#!/usr/bin/env bash
# pull-guardian-staging.sh — deploy a candidate guardian-engine image to the
# ISOLATED staging instance (~/guardian-staging) by pulling from Docker Hub.
# Staging has its own network, DB volume, and certs; it is NOT federated and
# cannot affect prod (guardian.tacops.io).
#
# Promotion loop:
#   1) ./deploy/pull-guardian-staging.sh git-<sha>   # deploy candidate to staging
#   2) smoke-test https://127.0.0.1:3511  (health :3520)
#   3) ./deploy/pull-guardian.sh git-<sha>           # promote SAME tag to prod
#
# Usage:  ./deploy/pull-guardian-staging.sh [TAG]    (TAG defaults to 'latest')
# Env:    STAGING_DIR (default: $HOME/guardian-staging)
set -euo pipefail
STAGING_DIR="${STAGING_DIR:-$HOME/guardian-staging}"
export GUARDIAN_TAG="${1:-latest}"

echo "==> STAGING (${STAGING_DIR}) pull + up  :${GUARDIAN_TAG}"
( cd "$STAGING_DIR" && docker compose -p guardian-staging pull guardian-engine && docker compose -p guardian-staging up -d guardian-engine )

echo "==> Health (internal :3520/health, start period ~10s)"
ok=0
for i in $(seq 1 12); do
  sleep 5
  if curl -sf http://127.0.0.1:3520/health >/dev/null 2>&1; then ok=1; break; fi
  echo "   ...waiting ($((i*5))s)"
done
if [ "$ok" = 1 ]; then
  IMG="$(docker inspect guardian-engine-staging --format '{{.Image}}')"
  echo "==> staging healthy on guardian-engine:${GUARDIAN_TAG} (${IMG#sha256:})"
  echo "==> If good, promote:  ./deploy/pull-guardian.sh ${GUARDIAN_TAG}"
else
  echo "==> STAGING UNHEALTHY — check: docker logs --tail 40 guardian-engine-staging"; exit 1
fi
