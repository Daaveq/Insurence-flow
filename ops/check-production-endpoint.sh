#!/usr/bin/env bash

set -Eeuo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <base-url>" >&2
  exit 2
fi

readonly BASE_URL="${1%/}"
html_file="$(mktemp)"
trap 'rm -f -- "$html_file"' EXIT

curl --fail --silent --show-error --location --output "$html_file" --max-time 12 "$BASE_URL/"

mapfile -t assets < <(grep -oE '/_next/static/[A-Za-z0-9_./-]+\.(js|css)' "$html_file" | sort -u)
if [[ ${#assets[@]} -eq 0 ]]; then
  echo "No Next.js assets were found at $BASE_URL/" >&2
  exit 1
fi

for asset in "${assets[@]}"; do
  curl --fail --silent --show-error --location --output /dev/null --max-time 12 "$BASE_URL$asset"
done

curl --fail --silent --show-error --location --output /dev/null --max-time 12 "$BASE_URL/api/sources?case=standard"
