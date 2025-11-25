#!/usr/bin/env bash
set -euo pipefail

# Test VibeProxy token injection behavior using multiple header styles
# Usage: VIBE_TOKEN=abc123 ./scripts/vibeproxy_injection_test.sh
# or: ./scripts/vibeproxy_injection_test.sh --token abc123

VIBE_HOST="http://localhost:8317"
TOKEN=""
while [[ ${#} -gt 0 ]]; do
  case "$1" in
    --token) shift; TOKEN="$1"; shift ;;
    -h|--help) echo "Usage: $0 [--token <token>]"; exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -z "$TOKEN" && -n "${VIBE_TOKEN:-}" ]]; then
  TOKEN="$VIBE_TOKEN"
fi

echo "VibeProxy Injection Test to $VIBE_HOST"
echo

echo "Headerless request: GET /v1/models"
curl -s -S -i "$VIBE_HOST/v1/models" || true
echo

echo "With dummy Authorization header (dummy-not-used):"
curl -s -S -i -H "Authorization: Bearer dummy-not-used" "$VIBE_HOST/v1/models" || true
echo

if [[ -n "$TOKEN" ]]; then
  echo "With provided Authorization header..."
  curl -s -S -i -H "Authorization: Bearer $TOKEN" "$VIBE_HOST/v1/models" || true
  echo
fi

echo "Trying common alternative headers that some proxies accept..."
for hdr in "x-api-key" "x-forwarded-authorization" "x-forwarded-auth" "x-cli-proxy-token" "x-proxy-authorization"; do
  echo "Header: $hdr"
  if [[ -n "$TOKEN" ]]; then
    curl -s -S -i -H "$hdr: $TOKEN" "$VIBE_HOST/v1/models" || true
  else
    curl -s -S -i -H "$hdr: dummy-not-used" "$VIBE_HOST/v1/models" || true
  fi
  echo
done

echo "Test complete. If injecting a real token returns 200 while headerless returns 401, VibeProxy expects a header. If headerless returns 200, the proxy injects tokens when no Authorization header is present."

echo "If you prefer we can add a script to fetch the OAuth token from VibeProxy (if supported) and write it to the Factory config (not recommended, insecure), or help with step-by-step VibeProxy config options to enable token injection."
