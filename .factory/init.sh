#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  pnpm install
fi

pnpm validate:env >/dev/null

echo "Environment ready for the floor-plan read-only redesign mission."
