# 🌱 Seed File Quick Reference

## TL;DR - Which Seed Should I Use?

| Scenario                   | Command                              | Why                           |
| -------------------------- | ------------------------------------ | ----------------------------- |
| **Quick dev setup**        | `pnpm run db:reset-intelligent`      | Fast, realistic, configurable |
| **Testing schema changes** | `pnpm run db:seed-schema`            | Auto-adapts to schema changes |
| **Production-like data**   | `pnpm run db:reset`                  | Large scale, comprehensive    |
| **Capacity testing**       | `pnpm run db:seed-capacity-fixtures` | Specific capacity scenarios   |
| **CI/CD testing**          | `pnpm run db:seed-intelligent`       | Fast execution, predictable   |

## 📋 Available Commands

```bash
# Core commands
pnpm run db:migrate              # Just apply migrations
pnpm run db:seed-intelligent     # Smart seed (fast)
pnpm run db:seed-schema          # Schema-introspective seed
pnpm run db:seed-only            # Original seed

# Reset workflows
pnpm run db:reset                # Migrate + original seed
pnpm run db:reset-intelligent    # Migrate + intelligent seed
pnpm run db:reset-schema         # Migrate + schema seed

# Utilities
pnpm run db:verify               # Check database state
pnpm run db:wipe                 # ⚠️  Drop everything
pnpm run db:status               # Show migration status
```

## 🔍 Seed File Comparison

### intelligent-seed.sql

```bash
pnpm run db:seed-intelligent
```

**Pros:**

- ✅ Fast execution (~15 seconds)
- ✅ Realistic data distributions
- ✅ Easy to configure (variables at top)
- ✅ Good for daily development
- ✅ Minimal hardcoding

**Cons:**

- ⚠️ Some enum values are hardcoded
- ⚠️ Needs manual updates for new types

**When to use:**

- Daily development
- Quick prototyping
- Feature testing
- CI/CD pipelines

### schema-driven-seed.sql

```bash
pnpm run db:seed-schema
```

**Pros:**

- ✅ Zero hardcoded enum values
- ✅ Auto-adapts to schema changes
- ✅ Introspects database structure
- ✅ Shows schema information
- ✅ Future-proof

**Cons:**

- ⚠️ Slightly slower (~20 seconds)
- ⚠️ More complex code

**When to use:**

- After schema migrations
- Testing enum additions
- Validating constraints
- Schema evolution testing

### seed.sql (original)

```bash
pnpm run db:seed-only
```

**Pros:**

- ✅ Production-scale data
- ✅ Comprehensive coverage
- ✅ Well-tested
- ✅ Real-world scenarios

**Cons:**

- ⚠️ Slower execution (~60 seconds)
- ⚠️ Fixed scale
- ⚠️ Many hardcoded values

**When to use:**

- Staging environments
- Performance testing
- Demo environments
- Production-like scenarios

## 💡 Common Workflows

### Fresh Start

```bash
pnpm run db:wipe                # Clear everything
pnpm run db:reset-intelligent   # Migrate + seed
pnpm run db:verify              # Check it worked
```

### After Schema Changes

```bash
pnpm run db:migrate             # Apply new migrations
pnpm run db:seed-schema         # Seed with auto-detection
```

### Quick Feature Test

```bash
pnpm run db:seed-intelligent    # Fast seed only
# Test your feature
```

### Before Production Deploy

```bash
pnpm run db:migrate             # Migrations first
pnpm run db:seed-only           # Production-scale data
pnpm run db:verify              # Validate
```

## 🎯 Data Scale Comparison

| Seed Type         | Restaurants | Tables | Customers | Bookings | Time |
| ----------------- | ----------- | ------ | --------- | -------- | ---- |
| **intelligent**   | 5           | 100    | 500       | 250      | ~15s |
| **schema-driven** | 3           | 63     | 180       | 120      | ~20s |
| **original**      | 8           | 160+   | 480+      | 260+     | ~60s |

## 🔧 Customizing Scale

### intelligent-seed.sql

Edit the variables at the top:

```sql
v_num_restaurants INT := 5;              -- Change this
v_tables_per_restaurant INT := 20;       -- And this
v_customers_per_restaurant INT := 100;   -- And this
v_bookings_per_restaurant INT := 50;     -- And this
```

### schema-driven-seed.sql

Edit the configuration block:

```sql
cfg_restaurants := 3;                    -- Change this
cfg_zones_per_restaurant := 3;           -- And this
cfg_tables_per_zone := 7;                -- And this
cfg_customers_per_restaurant := 60;      -- And this
```

## 🚀 Performance Tips

1. **Use intelligent seeds for development**
   - Faster iteration
   - Less data to wade through
2. **Use schema seeds after migrations**
   - Validates new types work
   - Tests constraint changes
3. **Use original seeds for staging**
   - Production-like volume
   - Comprehensive scenarios

## 📊 What Gets Generated

All seed files create:

- 🏪 Restaurants (with UK addresses)
- 🏢 Zones (dining areas)
- 🪑 Tables (varied capacities)
- 👤 User profiles (auth.users + profiles)
- 👥 Customers (linked to profiles)
- 📅 Bookings (temporal distribution)
- ⏰ Operating hours
- 🔗 Table adjacencies
- 📊 Analytics events (schema-driven only)

## 🐛 Troubleshooting

### "relation does not exist"

```bash
pnpm run db:migrate  # Run migrations first
```

### "permission denied"

```bash
# Check your database URL
echo $SUPABASE_DB_URL
```

### "duplicate key"

Seeds are idempotent - they truncate first. This shouldn't happen.

### Too slow

```bash
# Use intelligent seed with reduced scale
pnpm run db:seed-intelligent
```

### Need more data

Edit the configuration variables in the seed file, then re-run.

## 🎓 Advanced Usage

### Chain Commands

```bash
# Complete refresh
pnpm run db:wipe && pnpm run db:reset-intelligent && pnpm run db:verify
```

### Conditional Seeding

```bash
# Only seed if empty
psql "$SUPABASE_DB_URL" -c "SELECT COUNT(*) FROM restaurants" | grep -q " 0$" && pnpm run db:seed-intelligent
```

### Backup Before Seed

```bash
# Export current state
pg_dump "$SUPABASE_DB_URL" > backup.sql

# Run seed
pnpm run db:seed-intelligent

# Restore if needed
psql "$SUPABASE_DB_URL" < backup.sql
```

## 📚 Further Reading

- [Full Seed Documentation](./README.md)
- [REMOTE_ONLY_SETUP.md](../../REMOTE_ONLY_SETUP.md)
- [Database Schema Docs](../../docs/database/)

---

**Pro Tip:** Start with `db:reset-intelligent` for development, graduate to `db:reset` for staging/demo environments.
