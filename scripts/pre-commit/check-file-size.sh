#!/bin/bash

# Check for large files before commit
# Prevents accidentally committing files over the threshold

MAX_FILE_SIZE_KB=500
MAX_LINE_COUNT=1000
ERRORS=0

echo "🔍 Checking file sizes..."

# Get staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED_FILES" ]; then
  echo "✅ No staged files to check"
  exit 0
fi

for FILE in $STAGED_FILES; do
  # Skip if file doesn't exist (deleted)
  if [ ! -f "$FILE" ]; then
    continue
  fi

  # Skip binary files and common large file types
  case "$FILE" in
    *.lock|*.png|*.jpg|*.jpeg|*.gif|*.ico|*.svg|*.woff|*.woff2|*.ttf|*.eot|*.mp4|*.webm|*.pdf)
      continue
      ;;
    node_modules/*|.next/*|dist/*|*.min.js|*.min.css)
      continue
      ;;
  esac

  # Check file size
  FILE_SIZE_KB=$(du -k "$FILE" | cut -f1)
  if [ "$FILE_SIZE_KB" -gt "$MAX_FILE_SIZE_KB" ]; then
    echo "❌ $FILE is ${FILE_SIZE_KB}KB (max: ${MAX_FILE_SIZE_KB}KB)"
    ERRORS=$((ERRORS + 1))
  fi

  # Check line count for source files
  case "$FILE" in
    *.ts|*.tsx|*.js|*.jsx)
      LINE_COUNT=$(wc -l < "$FILE" | tr -d ' ')
      if [ "$LINE_COUNT" -gt "$MAX_LINE_COUNT" ]; then
        echo "⚠️  $FILE has $LINE_COUNT lines (recommended max: $MAX_LINE_COUNT)"
        # Warning only, don't fail
      fi
      ;;
  esac
done

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "❌ Found $ERRORS file(s) exceeding size limit."
  echo "   Consider:"
  echo "   - Moving large assets to CDN/storage"
  echo "   - Splitting large source files"
  echo "   - Using Git LFS for binary files"
  exit 1
fi

echo "✅ All files within size limits"
exit 0
