#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  pnpm install
fi

ORIGINAL_CHECKOUT="/Users/amankumarshrestha/LapenInns Project/nabatableLP"

# Reuse the existing local env file from the original checkout when running in the isolated worktree.
if [ ! -e ".env.local" ] && [ -f "${ORIGINAL_CHECKOUT}/.env.local" ]; then
  ln -sf "${ORIGINAL_CHECKOUT}/.env.local" ".env.local"
fi

echo "Environment ready."
