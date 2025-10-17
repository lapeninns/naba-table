# Supabase Directory Index

## 📍 Start Here

1. **`README_SETUP.md`** - Complete setup guide (5 min read)
2. **`init-database.sql`** - Single command for all migrations
3. **`init-seeds.sql`** - Single command for all seeds

## 🚀 Quick Commands

```bash
pnpm run db:reset          # ← Do this first! (everything)
pnpm run db:verify         # Check it worked
pnpm run db:studio         # Browse in UI
```

## 📚 Documentation

| File                                   | Purpose                            |
| -------------------------------------- | ---------------------------------- |
| `README_SETUP.md`                      | **START HERE** - Setup walkthrough |
| `seeds/README.md`                      | What each seed does                |
| `../QUICK_START_SUPABASE.md`           | Quick reference card               |
| `../SUPABASE_ORGANIZATION_COMPLETE.md` | What changed & why                 |

## 📁 Structure

```
supabase/
├── init-database.sql           # Apply all migrations
├── init-seeds.sql              # Seed all data
├── create-database.sql         # Legacy (reference only)
├── wipe-public-schema.sql      # Emergency cleanup
│
├── migrations/                 # Schema changes (22 files)
│   ├── 20250101000000_remote_schema.sql
│   ├── 20250115071800_add_booking_confirmation_token.sql
│   └── ... (20 more, applied in order)
│
├── seeds/                      # Test data
│   ├── seed.sql                # Main seed (legacy)
│   ├── seed-table-inventory.sql
│   ├── seed-today-bookings.sql
│   └── manual/
│
├── manual-rollbacks/           # Emergency fixes
│   └── 20251016092200_capacity_engine_rollback.sql
│
└── .branches/                  # Branch snapshots
```

## 🎯 Commands

### Run Everything

```bash
pnpm run db:reset          # Migrations + seeds (~60s)
```

### Run Separately

```bash
pnpm run db:migrate        # Just migrations
pnpm run db:seed-only      # Just seeds
pnpm run db:full-reset     # Full reset with logs
```

### Utilities

```bash
pnpm run db:verify         # Check seeds worked
pnpm run db:status         # Database status
pnpm run db:studio         # Open Supabase Studio
pnpm run db:wipe           # Drop public schema ⚠️
```

## 📊 Seed Data

After running `pnpm run db:reset`:

- **8 Restaurants** (La Peninns pub chain)
- **480 Customers** (60 per restaurant)
- **260+ Bookings** (past, today, future)
- **128 Tables** (16 per restaurant)
- **56 Operating Hours** (7 days × 8 restaurants)
- **32 Service Periods** (4 periods × 8 restaurants)

## 🔐 Admin

Auto-configured: `amanshresthaaaaa@gmail.com`  
Role: Owner (all restaurants)

## 💡 Common Tasks

### Reset Database

```bash
pnpm run db:reset
```

### Add New Seed

1. Edit: `init-seeds.sql`
2. Run: `pnpm run db:reset`

### Add New Migration

1. Create: `migrations/TIMESTAMP_description.sql`
2. Add to: `init-database.sql`
3. Run: `pnpm run db:reset`

### Check Data

```bash
pnpm run db:studio
# Or SQL:
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM public.restaurants;"
```

## 🆘 Troubleshooting

| Problem             | Solution                                  |
| ------------------- | ----------------------------------------- |
| Command not found   | Run `npm install` first                   |
| Duplicate key error | Run `pnpm run db:reset` (clears old data) |
| Function missing    | Ensure migrations ran first               |
| Slow seeding        | First run is slow (30-60s), normal        |

## ✅ Files Created/Updated

- ✅ `init-database.sql` - Consolidated migrations
- ✅ `init-seeds.sql` - Consolidated seeds
- ✅ `README_SETUP.md` - Setup guide
- ✅ `seeds/README.md` - Updated seed docs
- ✅ `package.json` - Added 4 npm scripts

## 📞 Next Steps

1. Read: `README_SETUP.md`
2. Run: `pnpm run db:reset`
3. Verify: `pnpm run db:verify`
4. Browse: `pnpm run db:studio`

---

**Last Updated:** October 17, 2025  
**Status:** Production-Ready ✅
