#!/usr/bin/env bash
# promote.sh — deploy a tag to staging, smoke it, then promote the SAME tag to
# prod. Stops before prod if staging is unhealthy (pull-guardian-staging.sh
# exits non-zero on a failed health check, and `set -e` aborts here).
#
# Usage:  ./deploy/promote.sh <TAG>      (e.g. git-<sha>, or 'latest')
set -euo pipefail
TAG="${1:?usage: ./deploy/promote.sh <TAG>}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> [1/2] STAGING ${TAG} (deploy + smoke)"
"$SCRIPT_DIR/pull-guardian-staging.sh" "$TAG"

echo "==> [2/2] PROMOTE ${TAG} -> PROD"
"$SCRIPT_DIR/pull-guardian.sh" "$TAG"

echo "==> promoted guardian-engine:${TAG} to prod"
