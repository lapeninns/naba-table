# Supabase Directory - Remote Only

> ⚠️ **Important**: This project uses **remote Supabase only**. No local Supabase or Docker required.

Last cleaned: October 17, 2025

## 📁 Directory Organization

```
supabase/
├── .branches/          # Supabase CLI branch configuration
├── .temp/              # Temporary CLI files (auto-generated)
├── docs/               # Documentation and setup guides
│   ├── SEED_DATA_GUIDE.md           # ✨ Comprehensive seed data documentation
│   ├── SEED_ENHANCEMENT_SUMMARY.md  # ✨ v2.0 enhancement details
│   ├── SEED_QUICK_REFERENCE.md      # ✨ Quick reference card
│   ├── DATABASE_VERIFICATION.md     # Database verification guide
│   └── README_SETUP.md              # Remote-only setup instructions
├── migrations/         # ✅ Database migration files (synced with remote)
├── utilities/          # Utility SQL scripts for maintenance
│   ├── init-seeds.sql  # ✨ Enhanced seed script v2.0 (23 tables)
│   └── wipe-public-schema.sql
└── manual-rollbacks/   # Manual rollback scripts for migrations
```

## 🌱 Seed Data (Enhanced v2.0)

**New in v2.0**: Comprehensive demo data covering all 23 tables with realistic diversity

### Quick Start

```bash
# Seed database with demo data
pnpm run db:seed-only

# Verify seed data
pnpm run db:verify
```

### What's Included

- ✅ 8 restaurants (multi-cuisine)
- ✅ 530 customers with diverse profiles
- ✅ 310 bookings (past/today/future)
- ✅ 111 Stripe payment events ✨ NEW
- ✅ Enhanced customer preferences (dietary, seating, occasions) ✨ NEW
- ✅ Realistic booking status distribution ✨ NEW
- ✅ Full table inventory, capacity rules, loyalty programs, and more

📚 **See**: `docs/SEED_QUICK_REFERENCE.md` for quick reference  
📖 **Full Guide**: `docs/SEED_DATA_GUIDE.md` for comprehensive documentation

## 🗄️ Migrations (21 files)

All migration files follow the naming pattern: `<timestamp>_<description>.sql`

**Current Status:** ✅ All migrations synced with remote database

### Latest Migration

- `20251017123500_harden_booking_timezone.sql` - Added booking timezone hardening

## 📝 Guidelines

### ✅ DO:

- Use `supabase db push` to apply migrations to remote
- Use `supabase migration list` to check sync status
- Create migrations with proper timestamp naming
- Test carefully before pushing to remote

### ❌ DON'T:

- ❌ Run `supabase start` or `supabase db reset` (requires local Docker)
- ❌ Use `localhost:54321` connections
- ❌ Set up local Supabase instance
- ❌ Use Docker for database operations

### Adding New Migrations

```bash
# Create a new migration
supabase migration new <description>

# Apply to remote (after reviewing)
supabase db push
```

### Checking Status

```bash
# View migration status
supabase migration list

# Both Local and Remote columns should match
```

### File Naming Rules

- **Migrations**: MUST be `<timestamp>_name.sql` format
- **Documentation**: Place in `docs/` folder
- **Utilities**: Place in `utilities/` folder
- **Seeds**: Place in `seeds/` folder

## 🚫 What NOT to Include

- ❌ `.md` files in migrations folder
- ❌ Test SQL files without timestamps
- ❌ Documentation in root directory
- ❌ Empty migration files

## ✅ Clean Structure Benefits

1. **No skipped migrations** - All files follow correct naming
2. **Easy navigation** - Clear folder structure
3. **Synced state** - Local matches remote exactly
4. **Organized docs** - Separate from working files

## 🔗 Related Commands

```bash
# Push migrations to remote
supabase db push

# Check migration status
supabase migration list

# Repair migration history (if needed)
supabase migration repair --status [applied|reverted] <version>
```

## 📦 Backup Location

Full backups are stored in: `backups/supabase-backup-<timestamp>/`
