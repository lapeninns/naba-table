#!/usr/bin/env bash
set -euo pipefail

# Simple checks to validate a local VibeProxy / CLIProxyAPI instance
# and whether Authorization header is being enforced/forwarded causing 401

VIBE_HOST="http://localhost:8317"

usage() {
  cat <<EOF
Usage: $(basename "$0") [--provider openai|anthropic|all] [--model MODEL]
Example:
  $(basename "$0") --provider openai --model gpt-5.1
EOF
}

PROVIDER="all"
MODEL=""
while [[ ${#} -gt 0 ]]; do
  case "$1" in
    --provider) shift; PROVIDER="$1"; shift ;;
    --model) shift; MODEL="$1"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1"; usage; exit 1 ;;
  esac
done

echo "Checking VibeProxy at $VIBE_HOST"
echo "Server base: $VIBE_HOST"

echo "Checking root base response..."
curl -s -S -i "$VIBE_HOST" || true
echo

echo "Trying common endpoints: /v1/models, /v1/responses"
curl -s -S -i "$VIBE_HOST/v1/models" || true
echo
curl -s -S -i "$VIBE_HOST/v1/responses" || true
echo

if [[ "$PROVIDER" == "all" || "$PROVIDER" == "openai" ]]; then
  echo "Testing OpenAI-style request (GET /v1/models) with Authorization header (dummy-not-used)..."
  curl -s -S -i -H "Authorization: Bearer dummy-not-used" "$VIBE_HOST/v1/models" || true
  echo
  echo "Testing no Authorization header..."
  curl -s -S -i "$VIBE_HOST/v1/models" || true
  echo
fi

if [[ "$PROVIDER" == "all" || "$PROVIDER" == "anthropic" ]]; then
  echo "Testing Anthropic-style request (GET /v1/models) with Authorization header (dummy-not-used)..."
  curl -s -S -i -H "Authorization: Bearer dummy-not-used" "$VIBE_HOST/v1/models" || true
  echo
  echo "Testing no Authorization header..."
  curl -s -S -i "$VIBE_HOST/v1/models" || true
  echo
fi

if [[ -n "$MODEL" ]]; then
  echo "Testing a basic POST to /v1/responses for model $MODEL"
  curl -s -S -i -X POST "$VIBE_HOST/v1/responses" -H 'Content-Type: application/json' -d '{"model":"'$MODEL'","input":"what day is it?"}' || true
  echo
fi

cat <<-EOF
Diagnostics complete.
If the Authorization: Bearer dummy-not-used request returns 401 while the unauthenticated request works or returns a 2xx/3xx/404, it likely means the proxy is forwarding the header and the upstream provider returns a 401.

Remedies:
 - Ensure VibeProxy is running and connected to your account(s) (Green dot in menu bar).
 - Make sure Factory's base_url is correct for the provider (openai -> /v1; anthropic -> /).
 - Remove or blank the api_key in your local `.factory/config.json` to avoid sending an Authorization header (Factory will not send it).
 - If Factory always sends a header, configure VibeProxy to accept any header or transform it into a usable token, or set the provider in Factory config to the proxy provider instructions.
 - Check VibeProxy logs (Open Settings -> Open logs) to see if it received requests and whether it returned an error.

EOF
