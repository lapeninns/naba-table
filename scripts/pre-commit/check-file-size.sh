#!/usr/bin/env bash

set -euo pipefail

MAX_FILE_BYTES=1000000
MAX_SOURCE_LINES=2200
MODE="${1:---all}"
errors=0

if [[ "$MODE" == "--staged" ]]; then
  files_command=(git diff --cached --name-only --diff-filter=ACM -z)
else
  files_command=(git ls-files --cached --others --exclude-standard -z)
fi

while IFS= read -r -d '' file; do
  [[ -f "$file" ]] || continue

  case "$file" in
    # Immutable historical artifacts above the current limit are grandfathered;
    # any replacement path or growth elsewhere must satisfy the active budget.
    .deepsec/findings.json|.playwright-cli/console-2026-04-22T11-46-39-096Z.log|restaurant-settings-frontend-consolidated-20260516-1945.json)
      continue
      ;;
    pnpm-lock.yaml|types/supabase.ts|*.png|*.jpg|*.jpeg|*.gif|*.ico|*.woff|*.woff2|*.ttf|*.pdf|*.mp4|*.webm)
      continue
      ;;
  esac

  bytes=$(wc -c < "$file" | tr -d ' ')
  if (( bytes > MAX_FILE_BYTES )); then
    echo "ERROR: $file is $bytes bytes; limit is $MAX_FILE_BYTES."
    errors=$((errors + 1))
  fi

  case "$file" in
    *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs)
      lines=$(wc -l < "$file" | tr -d ' ')
      if (( lines > MAX_SOURCE_LINES )); then
        echo "ERROR: $file is $lines lines; limit is $MAX_SOURCE_LINES."
        errors=$((errors + 1))
      fi
      ;;
  esac
done < <("${files_command[@]}")

if (( errors > 0 )); then
  echo "Large-file guard failed with $errors violation(s)."
  exit 1
fi

echo "Large-file guard passed."
