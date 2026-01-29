#!/usr/bin/env bash
set -euo pipefail

# Clean up merged local branches (excluding main/master/develop)
# Usage: ./scripts/git/clean-branches.sh [--dry-run]

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

echo "🧹 Cleaning merged branches..."
echo ""

# Get default branch (main or master)
DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@')

# Get current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Find merged branches (excluding main, master, develop, and current)
MERGED=$(git branch --merged "$DEFAULT_BRANCH" | grep -v "^\*" | grep -v "main" | grep -v "master" | grep -v "develop" || true)

if [ -z "$MERGED" ]; then
  echo "✅ No merged branches to clean up"
  exit 0
fi

echo "Merged branches to delete:"
echo "$MERGED"
echo ""

if [ "$DRY_RUN" = true ]; then
  echo "🔍 Dry run mode: no branches deleted"
  exit 0
fi

read -p "Delete these branches? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "$MERGED" | xargs -n 1 git branch -d
  echo "✅ Branches deleted"
else
  echo "❌ Cancelled"
fi
