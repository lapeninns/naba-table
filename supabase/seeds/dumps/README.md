# Database Seed Dump - November 8, 2025

This directory contains a complete dump of your Supabase production database seed data.

## 📦 What Was Dumped

The following tables were successfully exported:

### ✅ Tables with Data

| Table                       | File                                            | Description                                |
| --------------------------- | ----------------------------------------------- | ------------------------------------------ |
| `restaurants`               | `restaurants-20251108-093935.sql`               | 1 restaurant (White Horse Pub, Waterbeach) |
| `zones`                     | `zones-20251108-093935.sql`                     | 3 zones (Main Bar, Dining Room, Garden)    |
| `allowed_capacities`        | `allowed_capacities-20251108-093935.sql`        | Capacity configurations for the restaurant |
| `table_adjacencies`         | `table_adjacencies-20251108-093935.sql`         | Table adjacency relationships              |
| `bookings`                  | `bookings-20251108-093935.sql`                  | Current bookings in the system             |
| `booking_table_assignments` | `booking_table_assignments-20251108-093935.sql` | Table assignments for bookings             |

### ⚠️ Tables with No Data (Skipped)

- `service_periods` - No data
- `tables` - No data (NOTE: This seems unusual - you may want to check)
- `occasions` - No data
- `booking_status_changes` - No data
- `team_memberships` - No data
- `team_invitations` - No data

## 📄 Files Generated

### Individual Table Dumps

- `restaurants-20251108-093935.sql`
- `zones-20251108-093935.sql`
- `allowed_capacities-20251108-093935.sql`
- `table_adjacencies-20251108-093935.sql`
- `bookings-20251108-093935.sql`
- `booking_table_assignments-20251108-093935.sql`

### Combined Seed File

- **`full-seed-20251108-093935.sql`** - All-in-one restoration file

## 🚀 How to Restore

### Full Database Restore

To restore all data at once:

```bash
# Source your environment variables
source .env.local

# Run the combined seed file
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seeds/dumps/full-seed-20251108-093935.sql
```

### Restore Individual Tables

To restore specific tables:

```bash
source .env.local

# Restore just restaurants
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seeds/dumps/restaurants-20251108-093935.sql

# Restore zones
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seeds/dumps/zones-20251108-093935.sql

# etc...
```

## 📊 Current Data Summary

### Restaurant

- **ID**: `359d7726-f56f-4bcd-9be5-c3b240b8713f`
- **Name**: White Horse Pub
- **Slug**: `white-horse-pub-waterbeach`
- **Timezone**: Europe/London
- **Max Party Size**: 50
- **Email**: whitehorse@lapeninns.com
- **Total Covers**: 236
- **Logo**: ✅ Set

### Zones

1. **Main Bar** (Priority 1, Indoor)
2. **Dining Room** (Priority 2, Indoor)
3. **Garden** (Priority 3, Outdoor)

## ⚠️ Important Notes

1. **Missing Tables Data**: The `tables` table appears to be empty. This is critical for the reservation system. You should check if:
   - Tables were accidentally deleted
   - They need to be reseeded
   - There's a data issue

2. **Service Periods**: Also empty - you may need to reseed these as they define when the restaurant accepts bookings.

3. **TRUNCATE Warning**: The combined seed file will **TRUNCATE** all tables before inserting. This is destructive!

4. **Foreign Keys**: The dump respects foreign key constraints with CASCADE.

## 🔄 Next Steps

1. **Fix Missing Tables**: If tables data is missing, you should:

   ```bash
   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seeds/white-horse-service-periods.sql
   ```

2. **Backup Before Restore**: Always backup before running restore scripts!

3. **Test on Staging First**: If you have a staging environment, test there first.

## 📝 How This Was Generated

```bash
./scripts/dump-seed-data.sh
```

The script uses `pg_dump` to export data as INSERT statements for easy restoration.

---

**Generated**: 2025-11-08 09:39:35 UTC
**Database**: Production Supabase (`mqtchcaavsucsdjskptc`)
