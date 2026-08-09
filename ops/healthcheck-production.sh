#!/usr/bin/env bash

set -Eeuo pipefail

readonly APP_SERVICE="if-claims-copilot.service"
readonly TUNNEL_SERVICE="if-claims-copilot-tunnel.service"
readonly LOCAL_URL="http://127.0.0.1:3001/"
readonly PUBLIC_URL="https://co-pilot-ai.daviddemos.com/"
readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

is_healthy() {
  local url="$1"
  "$SCRIPT_DIR/check-production-endpoint.sh" "$url"
}

retry_health() {
  local url="$1"
  local attempt

  for attempt in 1 2 3; do
    if is_healthy "$url"; then
      return 0
    fi
    sleep 2
  done

  return 1
}

if ! systemctl --user is-active --quiet "$APP_SERVICE" || ! retry_health "$LOCAL_URL"; then
  echo "Local application is unhealthy; restarting $APP_SERVICE"
  systemctl --user restart "$APP_SERVICE"
  sleep 5
  retry_health "$LOCAL_URL"
fi

if ! systemctl --user is-active --quiet "$TUNNEL_SERVICE" || ! retry_health "$PUBLIC_URL"; then
  echo "Public endpoint is unhealthy; restarting $TUNNEL_SERVICE"
  systemctl --user restart "$TUNNEL_SERVICE"
  sleep 5
  retry_health "$PUBLIC_URL"
fi

echo "Claims Copilot local and public endpoints are healthy"
