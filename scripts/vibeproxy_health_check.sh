#!/usr/bin/env bash
set -euo pipefail

# Performs structured checks on a running VibeProxy/CLIProxyAPI instance.
# Returns 0 if health-check passes (able to list models and/or respond to requests)
# Returns non-zero otherwise. Prints a simple summary and logs.

VIBE_HOST="http://localhost:8317"
MODEL_TO_TEST="gpt-5.1"
TOKEN=""
while [[ ${#} -gt 0 ]]; do
  case "$1" in
    --token) shift; TOKEN="$1"; shift ;;
    --model) shift; MODEL_TO_TEST="$1"; shift ;;
    -h|--help) echo "Usage: $0 [--token TOKEN] [--model MODEL]"; exit 0 ;;
    --) shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo "=== VibeProxy Health Check ==="
echo "Host: $VIBE_HOST"
echo "Test Model: $MODEL_TO_TEST"

pass_count=0
fail_count=0

function ok() { ((pass_count++)); echo "[OK]  $1"; }
function fail() { ((fail_count++)); echo "[FAIL] $1"; }

echo "1) Checking root endpoint"
if curl -s -S -f "$VIBE_HOST" >/dev/null 2>&1; then ok "Host reachable"; else fail "Host not reachable"; fi

echo "2) Checking GET /v1/models (no header)"
if curl -s -S -f "$VIBE_HOST/v1/models" >/dev/null 2>&1; then ok "GET /v1/models headerless returned 200"; else fail "GET /v1/models headerless returned non-200"; fi

echo "3) Checking GET /v1/models with dummy Authorization header"
if curl -s -S -f -H "Authorization: Bearer dummy-not-used" "$VIBE_HOST/v1/models" >/dev/null 2>&1; then ok "GET /v1/models with dummy header returned 200 or 3xx"; else fail "GET /v1/models with dummy header returned non-200 (expected)"; fi

if [[ -n "$TOKEN" ]]; then
  echo "4) Checking GET /v1/models with provided token"
  if curl -s -S -f -H "Authorization: Bearer $TOKEN" "$VIBE_HOST/v1/models" >/dev/null 2>&1; then ok "GET /v1/models with provided token returned 200"; else fail "GET /v1/models with provided token returned non-200"; fi
fi

echo "5) Checking POST /v1/responses for $MODEL_TO_TEST headerless"
if curl -s -S -f -X POST "$VIBE_HOST/v1/responses" -H 'Content-Type: application/json' -d '{"model":"'$MODEL_TO_TEST'","input":"what day is it?"}' >/dev/null 2>&1; then ok "POST /v1/responses headerless returned 2xx"; else fail "POST /v1/responses headerless returned non-2xx"; fi

echo "\nSummary: $pass_count passed, $fail_count failed."
if [[ $fail_count -gt 0 ]]; then
  echo "Some checks failed. Review the diagnostics or VibeProxy settings."
  exit 2
else
  echo "All checks passed. VibeProxy appears to be inject/forwarding tokens correctly (if needed)."
  exit 0
fi
