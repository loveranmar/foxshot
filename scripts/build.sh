#!/usr/bin/env bash
# Packs extension/ into foxshot-<version>.crx at the repo root.
# The signing key lives in keys/foxshot.pem (created on first run, never
# committed); keep it to preserve the extension ID across versions.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
chrome="${CHROME:-$(command -v google-chrome-stable || command -v chromium || command -v brave)}"
key="$root/keys/foxshot.pem"
version="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['version'])" "$root/extension/manifest.json")"
out="$root/foxshot-$version.crx"

mkdir -p "$root/keys"
if [[ ! -f "$key" ]]; then
  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$key" 2>/dev/null
  chmod 600 "$key"
  echo "Created signing key $key"
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
cp -r "$root/extension" "$tmp/foxshot"

# A throwaway profile keeps this from talking to a running browser.
"$chrome" --user-data-dir="$tmp/profile" --no-first-run \
  --pack-extension="$tmp/foxshot" --pack-extension-key="$key" >/dev/null 2>&1 || true

if [[ ! -f "$tmp/foxshot.crx" ]]; then
  echo "Packing failed" >&2
  exit 1
fi

rm -f "$root"/foxshot-*.crx
mv "$tmp/foxshot.crx" "$out"
echo "Built $out"
