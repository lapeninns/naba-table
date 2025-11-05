#!/bin/bash
# Run auto-assignment for combination testing on 2025-11-15

# Update the script to target the new date
sed 's/TARGET_DATE: .2025-11-10./TARGET_DATE: '\''2025-11-15'\'',/' scripts/ops-auto-assign-ultra-fast.ts > /tmp/assign-combo-test.ts

echo "🚀 Running auto-assignment for combination testing (2025-11-15)..."
time pnpm tsx -r tsconfig-paths/register /tmp/assign-combo-test.ts
