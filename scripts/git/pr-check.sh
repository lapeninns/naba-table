#!/usr/bin/env bash
set -euo pipefail

# Pre-PR validation: runs lint, typecheck, and tests
# Usage: ./scripts/git/pr-check.sh

echo "🔍 Running pre-PR checks..."
echo ""

FAILED=()

# Lint
echo "1️⃣ Running lint..."
if pnpm lint; then
  echo "✅ Lint passed"
else
  echo "❌ Lint failed"
  FAILED+=("lint")
fi
echo ""

# Typecheck
echo "2️⃣ Running typecheck..."
if pnpm typecheck; then
  echo "✅ Typecheck passed"
else
  echo "❌ Typecheck failed"
  FAILED+=("typecheck")
fi
echo ""

# Tests
echo "3️⃣ Running tests..."
if pnpm test; then
  echo "✅ Tests passed"
else
  echo "❌ Tests failed"
  FAILED+=("test")
fi
echo ""

# Summary
if [ ${#FAILED[@]} -eq 0 ]; then
  echo "✨ All pre-PR checks passed! Ready to create PR."
  exit 0
else
  echo "❌ Pre-PR checks failed: ${FAILED[*]}"
  echo "Fix the issues above before creating a PR."
  exit 1
fi
