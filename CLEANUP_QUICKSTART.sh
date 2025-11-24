#!/bin/bash
# CLEANUP QUICK REFERENCE - Copy and paste commands below

# ╔═════════════════════════════════════════════════════════════════╗
# ║   Nab a Table Cleanup Scripts - Quick Reference                 ║
# ╚═════════════════════════════════════════════════════════════════╝

# 📋 USAGE GUIDE

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1️⃣  PREVIEW MODE (SAFE - Try This First!)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Using Bash script
./cleanup.sh --dry-run

# Using Python script
python3 cleanup.py --dry-run

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2️⃣  INTERACTIVE MODE (SAFE - Confirm Each Deletion)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Using Bash script (will ask for each deletion)
./cleanup.sh

# Using Python script (with interactive prompts)
python3 cleanup.py

# Per-file interactive (Python only)
python3 cleanup.py --interactive

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3️⃣  FORCE DELETE (FAST - No Confirmations)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Using Bash script (delete everything without asking)
./cleanup.sh --force

# Using Python script (delete everything without asking)
python3 cleanup.py --force

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 4️⃣  GET HELP
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

./cleanup.sh --help
python3 cleanup.py --help
cat CLEANUP_GUIDE.md

# ╔═════════════════════════════════════════════════════════════════╗
# ║   ✅ RECOMMENDED WORKFLOW                                       ║
# ╚═════════════════════════════════════════════════════════════════╝

# Copy and paste this entire section to execute full workflow:

# Step 1: Navigate to project
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# Step 2: Create backup commit
git add -A
git commit -m "chore: pre-cleanup backup"

# Step 3: Preview changes
./cleanup.sh --dry-run

# Step 4: Review output (look for anything important)

# Step 5: Execute cleanup (with confirmations)
./cleanup.sh

# Step 6: Verify everything still works
pnpm install
pnpm run build
pnpm run typecheck

# Step 7: Commit the cleanup
git add -A
git commit -m "chore: remove legacy code and test files"

# Step 8: View commit
git log --oneline -3

# ╔═════════════════════════════════════════════════════════════════╗
# ║   📊 WHAT GETS DELETED                                          ║
# ╚═════════════════════════════════════════════════════════════════╝

# ✂️ Test Files (~140 files, ~683 KB)
#    - *.test.ts
#    - *.test.tsx
#    - *.spec.ts
#    - *.spec.tsx

# ✂️ Documentation (~14 files, ~312 KB)
#    - COMPREHENSIVE_ROUTE_ANALYSIS.md
#    - DOCUMENTATION.md
#    - DoneList.md
#    - MASTER_INDEX.md
#    - ORGANIZATION_COMPLETE.md
#    - PROJECT_COMPLETION_SUMMARY.md
#    - QUICK_START_SUPABASE.md
#    - REMOTE_ONLY_SETUP.md
#    - ROUTE_QUICK_REFERENCE.md
#    - SUPABASE_ORGANIZATION_COMPLETE.md
#    - SUPABASE_SCHEMA_EXPORT_GUIDE.md
#    - VISUAL_ARCHITECTURE.md
#    - agents.md
#    - (And more...)

# ✂️ Directories
#    - backups/
#    - .reserve-dist/
#    - playwright-report/
#    - test-results/
#    - reports/
#    - .qodo/

# ✂️ Configuration & Scripts
#    - playwright.component.config.ts
#    - vitest.config.ts
#    - test-email.mjs
#    - squash_migrations.sh
#    - restaurant.json

# ✂️ Total: ~15+ MB freed

# ╔═════════════════════════════════════════════════════════════════╗
# ║   🛡️ PROTECTED (NOT DELETED)                                    ║
# ╚═════════════════════════════════════════════════════════════════╝

# ✅ node_modules/ - Never touched
# ✅ .git/ - Git history preserved
# ✅ src/, reserve/, server/ - Source code safe
# ✅ package.json, tsconfig.json - Config files safe
# ✅ README.md - Core documentation kept

# ╔═════════════════════════════════════════════════════════════════╗
# ║   ⚡ COMMON COMMANDS                                             ║
# ╚═════════════════════════════════════════════════════════════════╝

# Preview cleanup
./cleanup.sh --dry-run

# Run cleanup with confirmations
./cleanup.sh

# Force delete everything
./cleanup.sh --force

# Undo if something goes wrong
git reset --hard HEAD~1

# Check git status
git status

# View what changed
git diff HEAD~1

# Make scripts executable (if needed)
chmod +x cleanup.sh cleanup.py

# ╔═════════════════════════════════════════════════════════════════╗
# ║   ❓ TROUBLESHOOTING                                             ║
# ╚═════════════════════════════════════════════════════════════════╝

# Script not executable?
chmod +x cleanup.sh cleanup.py

# Python not found?
which python3
/usr/bin/python3 cleanup.py --dry-run

# Stuck on a prompt?
# Just press Ctrl+C to exit or type 'n' to skip

# Need to restore deleted files?
git reset --hard HEAD~1

# ╔═════════════════════════════════════════════════════════════════╗
# ║   📚 DOCUMENTATION                                              ║
# ╚═════════════════════════════════════════════════════════════════╝

# Full cleanup guide
cat CLEANUP_GUIDE.md

# Summary of what was created
cat CLEANUP_SUMMARY.md

# ╔═════════════════════════════════════════════════════════════════╗
# ║   🎯 NEXT STEPS                                                 ║
# ╚═════════════════════════════════════════════════════════════════╝

# 1. Run: ./cleanup.sh --dry-run
# 2. Review the output
# 3. Run: ./cleanup.sh (or ./cleanup.sh --force)
# 4. Verify: pnpm run build
# 5. Commit: git add -A && git commit -m "chore: cleanup"

# ═════════════════════════════════════════════════════════════════

echo "✅ Cleanup scripts are ready!"
echo "📖 Run: ./cleanup.sh --help for options"
echo "🚀 Quick start: ./cleanup.sh --dry-run"
