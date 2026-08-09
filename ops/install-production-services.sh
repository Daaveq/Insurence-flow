#!/usr/bin/env bash

set -Eeuo pipefail

readonly REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
readonly USER_UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
readonly DEPLOY_BIN_DIR="$REPO_ROOT/.deploy/bin"

mkdir -p "$USER_UNIT_DIR" "$DEPLOY_BIN_DIR"

for unit in \
  if-claims-copilot.service \
  if-claims-copilot-tunnel.service \
  if-claims-copilot-health.service \
  if-claims-copilot-health.timer; do
  install -m 0644 "$REPO_ROOT/ops/$unit" "$USER_UNIT_DIR/$unit"
done

install -m 0755 "$REPO_ROOT/ops/check-production-endpoint.sh" "$DEPLOY_BIN_DIR/check-production-endpoint.sh"
install -m 0755 "$REPO_ROOT/ops/healthcheck-production.sh" "$DEPLOY_BIN_DIR/healthcheck-production.sh"

systemctl --user daemon-reload
systemctl --user enable if-claims-copilot.service if-claims-copilot-tunnel.service
systemctl --user enable --now if-claims-copilot-health.timer

echo "Installed and enabled Claims Copilot production services"
