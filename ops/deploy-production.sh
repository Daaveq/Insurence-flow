#!/usr/bin/env bash

set -Eeuo pipefail

readonly REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
readonly DEPLOY_ROOT="$REPO_ROOT/.deploy"
readonly RELEASES_ROOT="$DEPLOY_ROOT/releases"
readonly CURRENT_LINK="$DEPLOY_ROOT/current"
readonly APP_SERVICE="if-claims-copilot.service"
readonly TUNNEL_SERVICE="if-claims-copilot-tunnel.service"
readonly HEALTH_SERVICE="if-claims-copilot-health.service"
readonly HEALTH_TIMER="if-claims-copilot-health.timer"
readonly LOCAL_URL="http://127.0.0.1:3001/"
readonly PUBLIC_URL="https://co-pilot-ai.daviddemos.com/"
readonly REVISION="${1:-main}"
readonly ENDPOINT_CHECK="$REPO_ROOT/ops/check-production-endpoint.sh"

resume_monitoring() {
  systemctl --user start "$HEALTH_TIMER" || true
}

systemctl --user stop "$HEALTH_TIMER" "$HEALTH_SERVICE" 2>/dev/null || true
trap resume_monitoring EXIT

if [[ ! -d "$REPO_ROOT/node_modules" ]]; then
  echo "node_modules is missing. Run npm ci before deploying." >&2
  exit 1
fi

commit="$(git -C "$REPO_ROOT" rev-parse --verify "$REVISION^{commit}")"
short_commit="$(git -C "$REPO_ROOT" rev-parse --short=12 "$commit")"
release_name="$(date -u +%Y%m%dT%H%M%SZ)-$short_commit"
release_dir="$RELEASES_ROOT/$release_name"
staged_link="$DEPLOY_ROOT/.current-$release_name"
previous_release=""

mkdir -p "$RELEASES_ROOT"

if [[ -L "$CURRENT_LINK" ]]; then
  previous_release="$(readlink -f "$CURRENT_LINK")"
fi

echo "Preparing immutable release $release_name from $REVISION"
mkdir "$release_dir"
git -C "$REPO_ROOT" archive "$commit" | tar -x -C "$release_dir"
cp -al "$REPO_ROOT/node_modules" "$release_dir/node_modules"

(
  cd "$release_dir"
  npm run build
)

ln -s "$release_dir" "$staged_link"
mv -Tf "$staged_link" "$CURRENT_LINK"

rollback() {
  if [[ -n "$previous_release" && -d "$previous_release" ]]; then
    echo "New release failed; rolling back to $previous_release" >&2
    ln -s "$previous_release" "$staged_link"
    mv -Tf "$staged_link" "$CURRENT_LINK"
    systemctl --user restart "$APP_SERVICE"
  fi
}

if ! systemctl --user restart "$APP_SERVICE"; then
  rollback
  exit 1
fi

healthy=false
for attempt in {1..20}; do
  if "$ENDPOINT_CHECK" "$LOCAL_URL"; then
    healthy=true
    break
  fi
  sleep 1
done

if [[ "$healthy" != true ]]; then
  rollback
  exit 1
fi

systemctl --user start "$TUNNEL_SERVICE"

public_healthy=false
for attempt in {1..12}; do
  if "$ENDPOINT_CHECK" "$PUBLIC_URL"; then
    public_healthy=true
    break
  fi
  sleep 2
done

if [[ "$public_healthy" != true ]]; then
  echo "Release is healthy locally, but the public endpoint did not recover." >&2
  exit 1
fi

mapfile -t old_releases < <(find "$RELEASES_ROOT" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -nr | tail -n +4 | cut -d' ' -f2-)
for old_release in "${old_releases[@]}"; do
  if [[ "$old_release" == "$RELEASES_ROOT"/* && "$old_release" != "$(readlink -f "$CURRENT_LINK")" ]]; then
    rm -rf -- "$old_release"
  fi
done

echo "Deployed $short_commit atomically; local and public health checks passed"
