# Intelligent Seed Files for SajiloReserveX

## Overview

This directory contains **schema-driven seed generators** that create realistic test data by introspecting your database schema rather than using hardcoded values.

## Available Seed Files

### 1. `intelligent-seed.sql`

**Best for: Quick development setup with realistic data**

- ✅ Generates data using minimal hardcoding
- ✅ Uses schema types (ENUMs, constraints) where possible
- ✅ Configurable scale via variables at top of file
- ✅ Fast execution (~10-30 seconds)
- ✅ Realistic temporal distributions
- ✅ Proper foreign key relationships

**Configuration Variables:**

```sql
v_num_restaurants := 5;              -- Number of restaurants
v_tables_per_restaurant := 20;       -- Tables per restaurant
v_customers_per_restaurant := 100;   -- Customers per restaurant
v_bookings_per_restaurant := 50;     -- Bookings per restaurant
v_days_back := 30;                   -- Historical bookings (days)
v_days_forward := 60;                -- Future bookings (days)
```

**Generates:**

- 🏪 Restaurants with realistic UK addresses
- 🏢 Zones (dining areas) per restaurant
- 🪑 Tables with varied capacities and types
- 👥 Customers with profiles
- 📅 Bookings with temporal distribution
- 🔗 Table adjacency graph for combinations
- 📊 Operating hours and service periods

### 2. `schema-driven-seed.sql`

**Best for: True zero-hardcode, schema-introspective generation**

- ✅ Reads ENUMs directly from `pg_catalog`
- ✅ Discovers types from `information_schema`
- ✅ Completely adaptive to schema changes
- ✅ Helper functions for UK data generation
- ✅ Detailed schema introspection output
- ✅ Analytics events generation

**Key Features:**

```sql
-- Dynamically loads enum values
all_booking_statuses := get_enum_values('booking_status');
all_table_categories := get_enum_values('table_category');

-- Generates from discovered schema
temp_status := all_booking_statuses[random_index]::booking_status;
```

**Configuration:**

```sql
cfg_restaurants := 3;
cfg_zones_per_restaurant := 3;
cfg_tables_per_zone := 7;
cfg_customers_per_restaurant := 60;
cfg_bookings_per_restaurant := 40;
```

**Additional Features:**

- Schema introspection report
- Analytics event generation
- Table adjacency graph
- Realistic data distributions

## Usage

### Option 1: Run via npm scripts (Recommended)

```bash
# Run intelligent seed (faster, good defaults)
pnpm run db:seed-intelligent

# Run schema-driven seed (introspective, adaptive)
pnpm run db:seed-schema

# Full reset + intelligent seed
pnpm run db:reset-intelligent

# Full reset + schema-driven seed
pnpm run db:reset-schema
```

### Option 2: Run directly with psql

```bash
# Source environment
source .env.local

# Run intelligent seed
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seeds/intelligent-seed.sql

# Run schema-driven seed
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seeds/schema-driven-seed.sql
```

### Option 3: Run after migration

```bash
# Migrate then seed
pnpm run db:migrate && pnpm run db:seed-intelligent
```

## Data Characteristics

### Realistic Distributions

**Party Sizes:**

- 50% → 2 people (couples)
- 30% → 4 people (small groups)
- 15% → 6 people (medium groups)
- 5% → 8+ people (large groups)

**Booking Times:**

- 20% → Lunch (12:00-15:00)
- 10% → Afternoon (15:00-18:00)
- 70% → Dinner (18:00-23:00)

**Booking Status (temporal):**

- **Past dates:** 70% completed, 10% no-show, 20% cancelled
- **Today:** 33% confirmed, 33% checked-in, 33% pending
- **Future:** 80% confirmed, 10% pending, 10% cancelled

**Table Capacities:**

- 50% → 2-seater tables
- 30% → 4-seater tables
- 15% → 6-seater tables
- 5% → 8+ seater tables

### Data Relationships

```
Restaurants (3-5)
  ├── Zones (3 per restaurant)
  │     └── Tables (7 per zone)
  │           └── Allowed Capacities
  ├── Operating Hours (7 days)
  ├── Customers (60-100 per restaurant)
  │     └── Profiles (auth.users)
  └── Bookings (40-50 per restaurant)
        ├── Analytics Events
        └── Table Assignments (future)
```

### Table Adjacencies

- 35% of same-zone tables are marked as adjacent
- Enables table combination scenarios
- Forms realistic floor plan graph

## Customization

### Modify Scale

Edit the configuration variables at the top of the DO block:

```sql
DO $$
DECLARE
    -- Change these values
    v_num_restaurants INT := 10;        -- More restaurants
    v_tables_per_restaurant INT := 30;   -- More tables
    v_customers_per_restaurant INT := 200; -- More customers
    -- ... rest of script
```

### Modify Time Range

```sql
v_days_back INT := 90;      -- 3 months history
v_days_forward INT := 180;   -- 6 months future
```

### Modify Data Distributions

Adjust the probability logic:

```sql
-- Make more VIPs (current: 10%)
is_vip := random() > 0.7;  -- Now 30%

-- More large parties
temp_party_size := CASE floor(random() * 10)::INT
    WHEN 0,1,2,3 THEN 2    -- 40% pairs
    WHEN 4,5,6 THEN 4      -- 30% groups of 4
    WHEN 7,8 THEN 6        -- 20% groups of 6
    ELSE 8                 -- 10% large groups
END;
```

## Performance

| Seed File                | Time | Records   | Notes                 |
| ------------------------ | ---- | --------- | --------------------- |
| `intelligent-seed.sql`   | ~15s | ~500-1000 | Fast, good for dev    |
| `schema-driven-seed.sql` | ~20s | ~300-600  | More introspection    |
| `seed.sql` (original)    | ~60s | ~1000+    | Production-like scale |

## Comparison with Original Seed

| Feature          | Original `seed.sql` | New Intelligent Seeds |
| ---------------- | ------------------- | --------------------- |
| Hardcoded values | Many                | Minimal to zero       |
| Schema awareness | Manual              | Automatic             |
| Configurability  | Limited             | High                  |
| Execution time   | ~60s                | ~15-20s               |
| Scale            | Fixed (large)       | Variable              |
| Adaptability     | Low                 | High                  |
| Documentation    | In-code             | Extensive             |

## Troubleshooting

### Error: "relation does not exist"

**Solution:** Run migrations first

```bash
pnpm run db:migrate
```

### Error: "password authentication failed"

**Solution:** Check your `SUPABASE_DB_URL` in `.env.local`

```bash
echo $SUPABASE_DB_URL
```

### Error: "duplicate key value violates unique constraint"

**Solution:** The script is idempotent but truncates first. If you're seeing this, ensure you're using the latest version of the seed file.

### Slow execution

**Solution:** Reduce scale parameters at the top of the file

## Best Practices

1. **Development:** Use `intelligent-seed.sql` with moderate scale
2. **Testing:** Use `schema-driven-seed.sql` for schema validation
3. **Staging:** Use original `seed.sql` for production-like data
4. **CI/CD:** Use intelligent seeds with minimal scale (fast tests)

## Contributing

When adding new tables or types:

1. **No action needed** for `schema-driven-seed.sql` (auto-adapts)
2. **Update arrays** in `intelligent-seed.sql` if adding new ENUMs
3. **Update documentation** in this README

## Examples

### Quick Dev Setup

```bash
# Start fresh
pnpm run db:wipe

# Migrate
pnpm run db:migrate

# Seed with small dataset
pnpm run db:seed-intelligent

# Verify
pnpm run db:verify
```

### Testing Schema Changes

```bash
# Make schema changes
# ...

# Run schema-driven seed (adapts automatically)
pnpm run db:seed-schema

# Check if data generation still works
psql "$SUPABASE_DB_URL" -c "SELECT COUNT(*) FROM bookings;"
```

### Generate Large Dataset

Edit `intelligent-seed.sql`:

```sql
v_num_restaurants := 20;
v_tables_per_restaurant := 50;
v_customers_per_restaurant := 500;
v_bookings_per_restaurant := 200;
```

Then run:

```bash
pnpm run db:seed-intelligent
```

## Schema Requirements

Both seed files require these tables:

- ✅ `auth.users`
- ✅ `profiles`
- ✅ `restaurants`
- ✅ `zones`
- ✅ `table_inventory`
- ✅ `customers`
- ✅ `bookings`
- ✅ `booking_occasions`
- ✅ `allowed_capacities`
- ✅ `table_adjacencies`

Optional tables (auto-detected):

- `analytics_events`
- `observability_events`
- `booking_slots`
- `restaurant_operating_hours`

## Future Enhancements

- [ ] Configuration via environment variables
- [ ] JSON config file support
- [ ] Data export/import for snapshots
- [ ] Realistic historical pattern generation
- [ ] Customer behavior simulation
- [ ] Seasonal demand patterns
- [ ] Multi-language name generation
- [ ] Integration with Faker.js equivalent in PL/pgSQL

---

**Last Updated:** 2024-11-05  
**Maintained by:** SajiloReserveX Team  
**License:** Same as parent project
