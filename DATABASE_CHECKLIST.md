# 🎯 Database Setup Checklist

## ✅ Completed Tasks

### Files Created

- [x] `supabase/migrations/20241006000001_initial_schema.sql` - Complete database schema
- [x] `supabase/seed.sql` - Seed data for 8 pubs with 400 bookings
- [x] `supabase/README.md` - Comprehensive database documentation
- [x] `supabase/verify-queries.sql` - SQL queries to verify seed data
- [x] `scripts/verify-seed.mjs` - Node.js seed verification script
- [x] `DATABASE_SETUP_COMPLETE.md` - Setup summary and quick reference

### Package.json Scripts Added

- [x] `db:start` - Start local Supabase
- [x] `db:stop` - Stop local Supabase
- [x] `db:reset` - Reset database + run migrations + seeds
- [x] `db:studio` - Open Supabase Studio
- [x] `db:seed` - Re-seed database
- [x] `db:status` - Check Supabase status
- [x] `db:verify` - Verify seed data with Node script

### Database Schema

- [x] Multi-tenant architecture (restaurants as tenants)
- [x] Row Level Security (RLS) policies
- [x] Timezone-aware booking timestamps
- [x] Overlap prevention constraints
- [x] Auto-generated booking references
- [x] Customer data normalization
- [x] Comprehensive indexes for performance

### Seed Data

- [x] 8 pubs with realistic names and capacities
- [x] 12 tables per pub (varied seating types)
- [x] 80 customers per pub (640 total)
- [x] 50 bookings per pub (400 total):
  - [x] 15 past bookings
  - [x] 5 today bookings
  - [x] 30 future bookings
- [x] No overlapping bookings
- [x] Varied booking statuses
- [x] Dummy owner user assigned to all pubs

### Documentation

- [x] Main README updated with database quick start
- [x] Comprehensive Supabase README
- [x] Database setup complete summary
- [x] SQL verification queries
- [x] Troubleshooting guide

## 🧪 Verification Steps

Run these to confirm everything works:

```bash
# 1. Check Supabase status
npm run db:status

# Expected output: Shows running services and connection details

# 2. Reset database (already done)
npm run db:reset

# Expected output:
# - Resetting local database...
# - Applying migration 20241006000001_initial_schema.sql...
# - Seeding data from supabase/seed.sql...
# - Finished supabase db reset on branch main.

# 3. Open Studio (already open)
# Navigate to: http://127.0.0.1:54323
# Check tables: restaurants, bookings, customers, restaurant_tables

# 4. Run verification queries
# Copy queries from supabase/verify-queries.sql into Studio SQL Editor
```

## 📊 Expected Results

When you run the verification queries in Supabase Studio:

### Query 1: Count all records

```
pubs    | tables | customers | bookings
--------|--------|-----------|----------
8       | 96     | 640       | 400
```

### Query 2: View all pubs

Should show 8 pubs:

- The Queen Elizabeth Pub (120 capacity)
- Old Crown Pub (100 capacity)
- White Horse Pub (110 capacity)
- The Corner House Pub (90 capacity)
- Prince of Wales Pub (130 capacity)
- The Bell Sawtry (80 capacity)
- The Railway Pub (95 capacity)
- The Barley Mow Pub (105 capacity)

### Query 3: Bookings distribution by pub

Each pub should have approximately:

- past_bookings: 15
- today_bookings: 5
- future_bookings: 30
- total_bookings: 50

### Query 6: Check for overlapping bookings

Should return **0 rows** (no overlaps)

## 🔄 Next Steps

### For Development

1. **Update Environment Variables**

   Edit `.env.local`:

   ```env
   # Local Supabase (from npm run db:status)
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
   ```

2. **Start Development Server**

   ```bash
   npm run dev
   ```

3. **Test Booking Features**
   - Navigate to `/reserve` in your app
   - Test creating bookings with the seeded data
   - Verify RLS policies work correctly

### For Production

1. **Link to Remote Supabase Project**

   ```bash
   supabase link --project-ref <your-project-ref>
   ```

2. **Push Migrations**

   ```bash
   supabase db push
   ```

3. **Seed Production (Optional - for staging only)**
   ```bash
   # ⚠️ Be careful! This adds data to production
   supabase db seed
   ```

## 🛠 Customization

### Add More Pubs

Edit `supabase/seed.sql` and add entries to the `restaurants` INSERT:

```sql
INSERT INTO public.restaurants (name, slug, timezone, capacity)
VALUES
  ('The Queen Elizabeth Pub', 'the-queen-elizabeth-pub', 'Europe/London', 120),
  ('Your New Pub', 'your-new-pub', 'Europe/London', 150),  -- Add here
  ...
```

Then run: `npm run db:reset`

### Change Number of Tables/Customers/Bookings

Edit the `generate_series()` calls in `supabase/seed.sql`:

```sql
-- Tables per pub (default: 12)
CROSS JOIN generate_series(1,12) AS gs

-- Customers per pub (default: 80, keep >= 50 for bookings)
CROSS JOIN generate_series(1,80) AS i

-- Past bookings (default: 15)
FROM generate_series(1,15) AS gs

-- Today bookings (default: 5)
FROM generate_series(0,4) AS gs

-- Future bookings (default: 30)
FROM generate_series(1,30) AS gs
```

Then run: `npm run db:reset`

### Use Real User IDs

Replace the dummy UUID in `supabase/seed.sql`:

```sql
-- Change this:
SELECT '00000000-0000-0000-0000-000000000001'::uuid AS user_id

-- To your real user ID:
SELECT 'your-real-user-id-here'::uuid AS user_id
```

## 📚 Documentation Links

- [DATABASE_SETUP_COMPLETE.md](./DATABASE_SETUP_COMPLETE.md) - Quick reference
- [supabase/README.md](./supabase/README.md) - Detailed database docs
- [Supabase CLI Docs](https://supabase.com/docs/guides/cli)
- [RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)

## 🐛 Troubleshooting

### Database won't start

```bash
# Stop and restart
npm run db:stop
npm run db:start
```

### Can't see seed data

```bash
# Reset database
npm run db:reset

# Check status
npm run db:status

# Verify in Studio: http://127.0.0.1:54323
```

### Port conflicts

If ports 54321-54324 are in use:

```bash
# Stop all containers
docker ps
docker stop <container-id>

# Restart Supabase
npm run db:start
```

### Changes not appearing

```bash
# Full reset
npm run db:stop
npm run db:reset
```

## ✨ Success Indicators

You know everything is working when:

- ✅ `npm run db:status` shows all services running
- ✅ Studio opens at http://127.0.0.1:54323
- ✅ Table Editor shows 8 restaurants
- ✅ Bookings table has 400 records
- ✅ Verification queries return expected counts
- ✅ No overlapping bookings found (Query 6)
- ✅ Your Next.js app can connect to Supabase

---

**All Done! 🎉**

Your database is ready for development. Start building features!
