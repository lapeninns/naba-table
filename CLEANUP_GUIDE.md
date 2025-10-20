# 🧹 SajiloReserveX Cleanup Scripts

Comprehensive cleanup scripts to remove legacy code, test files, documentation, and unnecessary files from the project.

## 📋 Overview

These scripts help you:

- ✅ Remove all test files (`*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx`)
- ✅ Delete documentation markdown files (except essential ones)
- ✅ Clean up legacy code and backup directories
- ✅ Remove temporary and cache directories
- ✅ Delete test configuration and legacy scripts

## 🚀 Quick Start

### Using the Bash Script (Recommended)

```bash
# Dry run - see what would be deleted
./cleanup.sh --dry-run

# Delete with confirmation prompts
./cleanup.sh

# Force delete without confirmation
./cleanup.sh --force
```

### Using the Python Script

```bash
# Dry run - see what would be deleted
python3 cleanup.py --dry-run

# Delete with confirmation prompts
python3 cleanup.py

# Force delete without confirmation
python3 cleanup.py --force

# Interactive mode - ask for each file
python3 cleanup.py --interactive
```

## 📦 What Gets Deleted

### Test Files

- `*.test.ts` - TypeScript test files
- `*.test.tsx` - React test files
- `*.spec.ts` - TypeScript spec files
- `*.spec.tsx` - React spec files
- `*.test.js` - JavaScript test files
- `*.spec.js` - JavaScript spec files

### Documentation Files

All markdown files (`.md`) in project root except:

- `README.md`
- `CONTRIBUTING.md`
- `LICENSE.md`

**Files that will be deleted:**

- `COMPREHENSIVE_ROUTE_ANALYSIS.md`
- `DOCUMENTATION.md`
- `DoneList.md`
- `MASTER_INDEX.md`
- `ORGANIZATION_COMPLETE.md`
- `PROJECT_COMPLETION_SUMMARY.md`
- `QUICK_START_SUPABASE.md`
- `REMOTE_ONLY_SETUP.md`
- `ROUTE_QUICK_REFERENCE.md`
- `SUPABASE_ORGANIZATION_COMPLETE.md`
- `SUPABASE_SCHEMA_EXPORT_GUIDE.md`
- `VISUAL_ARCHITECTURE.md`
- `agents.md`

### Directories

- `backups/` - Backup directory
- `.reserve-dist/` - Reserve distribution cache
- `playwright-report/` - Playwright test reports
- `test-results/` - Test results
- `reports/` - Reports directory
- `.qodo/` - Qodo cache

### Individual Files

- `playwright.component.config.ts` - Playwright component config
- `vitest.config.ts` - Vitest configuration
- `test-email.mjs` - Legacy test email script
- `squash_migrations.sh` - Migration squash script
- `restaurant.json` - Sample restaurant data

## ⚙️ Command Options

### Bash Script

```bash
./cleanup.sh [OPTIONS]

Options:
  -f, --force     Force deletion without confirmation prompts
  --dry-run       Show what would be deleted without actually deleting
  -h, --help      Show help message
```

### Python Script

```bash
python3 cleanup.py [OPTIONS]

Options:
  --force         Force deletion without confirmation prompts
  --dry-run       Show what would be deleted without actually deleting
  --interactive   Ask for confirmation for each deletion individually
  -h, --help      Show help message
```

## 🔍 Usage Examples

### Example 1: Safe Preview (Recommended First Step)

```bash
# See what will be deleted without making changes
./cleanup.sh --dry-run
```

Output:

```
ℹ [DRY RUN] Would delete: TypeScript test files (*.test.ts)
ℹ [DRY RUN] Would delete 45 files matching...
✓ Deleted: Backup directory
...
```

### Example 2: Interactive Cleanup

```bash
# Delete with confirmation for each item
./cleanup.sh

# You'll see prompts like:
# Delete Backup directory? (y/n) y
# Delete TypeScript test files (*.test.ts)? (y/n) y
```

### Example 3: Automated Cleanup

```bash
# Delete everything without confirmation (use with caution!)
./cleanup.sh --force
```

### Example 4: Python Script with Stats

```bash
# Get detailed cleanup statistics
python3 cleanup.py --force
```

Output includes:

- Total items deleted
- Space freed
- Detailed file counts per category

## 🛡️ Safety Considerations

### Before Running Any Cleanup:

1. **Backup your repository:**

   ```bash
   git add -A
   git commit -m "Pre-cleanup backup"
   ```

2. **Always test with `--dry-run` first:**

   ```bash
   ./cleanup.sh --dry-run
   ```

3. **Use version control to revert if needed:**
   ```bash
   git reset --hard HEAD~1  # Undo the cleanup
   ```

### What's Protected:

- ✅ `node_modules/` - Never deleted (filtered out)
- ✅ `.git/` - Git repository is safe
- ✅ Core source files (`src/`, `reserve/`, `server/`, etc.)
- ✅ Configuration files (`package.json`, `tsconfig.json`, etc.)
- ✅ Essential markdown files (README, LICENSE, etc.)

## 📊 Typical Cleanup Impact

For a project like SajiloReserveX:

| Item            | Count    | Est. Space |
| --------------- | -------- | ---------- |
| Test files      | ~150-200 | 5-10 MB    |
| Doc files       | ~10-15   | 1-2 MB     |
| Reports/results | Varies   | 10-50 MB   |
| Total           | ~200+    | 20-100 MB  |

## ⚡ Post-Cleanup Steps

After running the cleanup script:

```bash
# 1. Reinstall dependencies (just in case)
pnpm install

# 2. Verify build still works
pnpm run build

# 3. Check TypeScript compilation
pnpm run typecheck

# 4. Optional: Run linter
pnpm run lint

# 5. Commit the cleanup
git add -A
git commit -m "chore: clean up legacy code and test files"
```

## 🔧 Customization

### To Add More Files to Delete:

**For Bash script** - Edit `cleanup.sh`:

```bash
# Add to the KEEP_MD array for markdown files
KEEP_MD=(
    "README.md"
    "YOUR_FILE.md"  # ← Add here
)

# Add to safe_delete calls for directories
safe_delete "your/directory" "Your description"
```

**For Python script** - Edit `cleanup.py`:

```python
# Add to files_to_remove list
self.files_to_remove = [
    ('your-file.ts', 'Your file description'),
    ...
]

# Add to directories_to_remove list
self.directories_to_remove = [
    ('your-dir', 'Your directory description'),
    ...
]
```

## 🐛 Troubleshooting

### Script Not Found

```bash
# Make sure script is executable
chmod +x cleanup.sh
chmod +x cleanup.py

# Run with explicit path
./cleanup.sh --help
```

### Permission Denied

```bash
# Check file permissions
ls -la cleanup.sh cleanup.py

# Make executable if needed
chmod +x cleanup.sh cleanup.py
```

### Python Version Issues

```bash
# Check Python version (needs 3.6+)
python3 --version

# Try alternative if python3 not found
python cleanup.py --dry-run
```

### Stuck in Interactive Mode

```bash
# Press Ctrl+C to cancel
# Or just type 'n' and press Enter to skip
```

## 📝 Script Architecture

### Bash Script (`cleanup.sh`)

- Pure bash implementation
- No external dependencies
- Best for Unix/Linux/macOS
- Simple and transparent

### Python Script (`cleanup.py`)

- Object-oriented design
- Better error handling
- Cross-platform compatible
- More advanced statistics

## 🔐 Git Integration

If you're using git:

```bash
# Before cleanup
git status

# Run cleanup
./cleanup.sh --dry-run  # Preview first
./cleanup.sh --force     # Execute

# After cleanup
git status                # See what changed
git diff                  # Review changes
git add -A
git commit -m "chore: clean up legacy code, tests, and documentation"
```

## 📞 Need Help?

```bash
# View help for bash script
./cleanup.sh --help

# View help for Python script
python3 cleanup.py --help

# Ask for specific file patterns to keep
# Edit the scripts before running
```

## ✅ Verification Checklist

After cleanup, verify:

- [ ] Build succeeds: `pnpm run build`
- [ ] TypeScript compiles: `pnpm run typecheck`
- [ ] Linter passes: `pnpm run lint`
- [ ] Git status looks good: `git status`
- [ ] No important files deleted: `git diff --name-status`
- [ ] Dependencies intact: `pnpm list`

## 🎯 Recommended Workflow

```bash
# 1. Backup first
git commit -m "Pre-cleanup snapshot"

# 2. Preview changes
./cleanup.sh --dry-run > cleanup-preview.txt

# 3. Review preview
cat cleanup-preview.txt

# 4. Execute cleanup
./cleanup.sh

# 5. Verify everything
pnpm run build
pnpm run typecheck

# 6. Commit changes
git add -A
git commit -m "chore: remove legacy code and test files"

# 7. Done!
git log --oneline | head -5
```

---

**Last Updated:** October 20, 2025
**Version:** 1.0
