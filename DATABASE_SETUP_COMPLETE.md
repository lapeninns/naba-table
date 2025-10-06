# ✅ Database Setup Complete

Your Supabase database has been successfully organized and seeded!

## 📂 What Was Done

### 1. **Schema Migration Created**

- **File**: `supabase/migrations/20241006000001_initial_schema.sql`
- Complete database schema including:
  - ✅ Tables: restaurants, restaurant_memberships, customers, restaurant_tables, bookings
  - ✅ Custom types: booking_status, seating_type, seating_preference_type
  - ✅ Triggers: Auto-update timestamps, booking references, timezone conversions
  - ✅ Row Level Security (RLS) policies
  - ✅ Indexes for performance
  - ✅ Overlap prevention constraints

### 2. **Seed Data Created**

- **File**: `supabase/seed.sql`
- Seeds realistic test data:
  - ✅ 8 pubs with different capacities
  - ✅ 12 tables per pub (varied seating types)
  - ✅ 80 customers per pub
  - ✅ 50 bookings per pub (400 total):
    - 15 past bookings
    - 5 today bookings
    - 30 future bookings

### 3. **Package.json Scripts Added**

```json
{
  "db:reset": "supabase db reset", // Reset DB + run migrations + seeds
  "db:start": "supabase start", // Start local Supabase
  "db:stop": "supabase stop", // Stop local Supabase
  "db:studio": "supabase studio", // Open Studio UI
  "db:seed": "supabase db reset", // Re-seed database
  "db:status": "supabase status", // Check status
  "db:verify": "node scripts/verify-seed.mjs" // Verify seed data
}
```

### 4. **Documentation Created**

- ✅ `supabase/README.md` - Comprehensive database documentation
- ✅ `scripts/verify-seed.mjs` - Seed verification script
- ✅ This summary document

## 🚀 Quick Start Commands

### Start & Reset Database

```bash
# Start Supabase
npm run db:start

# Reset database (applies migrations + seeds)
npm run db:reset

# Check status
npm run db:status
```

### Access Supabase Studio

Open in your browser: **http://127.0.0.1:54323**

Or run:

```bash
# Open Studio URL from the db:status output
open http://127.0.0.1:54323
```

### Verify Seed Data

```bash
npm run db:verify
```

## 📊 Expected Database State

After seeding, you should have:

| Entity          | Count | Details                                                       |
| --------------- | ----- | ------------------------------------------------------------- |
| **Restaurants** | 8     | The Queen Elizabeth Pub, Old Crown Pub, White Horse Pub, etc. |
| **Tables**      | 96    | 12 tables per pub (T1-T12)                                    |
| **Customers**   | 640   | 80 customers per pub                                          |
| **Bookings**    | 400   | 50 bookings per pub                                           |

### Booking Distribution (per pub)

- **Past**: 15 bookings (CURRENT_DATE - 15 to -1 days)
- **Today**: 5 bookings (CURRENT_DATE at different times)
- **Future**: 30 bookings (CURRENT_DATE + 1 to +30 days)

### Booking Times

- Rotating time slots: 12:00, 13:30, 15:00, 17:30, 19:00, 20:30
- Duration: 105 minutes (1h 45m) each
- No overlapping bookings (enforced by EXCLUDE constraint)

## 🔗 Connection Details

From `npm run db:status`:

```
API URL:         http://127.0.0.1:54321
Studio URL:      http://127.0.0.1:54323
DB URL:          postgresql://postgres:postgres@127.0.0.1:54322/postgres
Anon Key:        eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Service Role:    eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 📝 File Structure

```
supabase/
├── README.md                                    # Comprehensive documentation
├── seed.sql                                     # Seed data (8 pubs + bookings)
├── migrations/
│   └── 20241006000001_initial_schema.sql       # Database schema
└── seed/                                        # (empty - seed.sql is at root)

scripts/
└── verify-seed.mjs                              # Seed verification script
```

## 🔍 Viewing Your Data

### Option 1: Supabase Studio (Recommended)

1. Open: http://127.0.0.1:54323
2. Navigate to "Table Editor"
3. Browse: restaurants, bookings, customers, etc.

### Option 2: SQL Queries

In Studio's SQL Editor, try:

```sql
-- Count all records
SELECT
  (SELECT COUNT(*) FROM restaurants) as pubs,
  (SELECT COUNT(*) FROM restaurant_tables) as tables,
  (SELECT COUNT(*) FROM customers) as customers,
  (SELECT COUNT(*) FROM bookings) as bookings;

-- View bookings distribution by pub
SELECT
  r.name,
  COUNT(CASE WHEN b.booking_date < CURRENT_DATE THEN 1 END) as past,
  COUNT(CASE WHEN b.booking_date = CURRENT_DATE THEN 1 END) as today,
  COUNT(CASE WHEN b.booking_date > CURRENT_DATE THEN 1 END) as future,
  COUNT(*) as total
FROM restaurants r
LEFT JOIN bookings b ON b.restaurant_id = r.id
GROUP BY r.id, r.name
ORDER BY r.name;

-- Check for overlapping bookings (should return 0 rows)
SELECT
  b1.id as booking1,
  b2.id as booking2,
  b1.table_id,
  b1.start_at,
  b1.end_at
FROM bookings b1
JOIN bookings b2
  ON b1.table_id = b2.table_id
  AND b1.id < b2.id
  AND b1.status IN ('confirmed', 'pending')
  AND b2.status IN ('confirmed', 'pending')
  AND tstzrange(b1.start_at, b1.end_at, '[)') && tstzrange(b2.start_at, b2.end_at, '[)');
```

## 🔄 Next Steps

### For Development

1. **Update `.env.local`** with local Supabase credentials:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
   ```

2. **Start your Next.js app**:

   ```bash
   npm run dev
   ```

3. **Test the booking system** with the seeded data

### For Production

1. **Link to remote project**:

   ```bash
   supabase link --project-ref <your-project-ref>
   ```

2. **Push migrations**:

   ```bash
   supabase db push
   ```

3. **Optionally seed staging** (⚠️ careful with production):
   ```bash
   supabase db seed
   ```

## 🎯 Dummy User for Testing

The seed creates a dummy owner with UUID:

```
00000000-0000-0000-0000-000000000001
```

All 8 pubs are assigned to this owner. You can:

- Use this UUID in your auth system
- Or update the seed file to use your real user IDs

## 📚 Resources

- [Supabase Documentation](https://supabase.com/docs/guides/cli)
- [Supabase README](./supabase/README.md) - Detailed setup guide
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Database Migrations](https://supabase.com/docs/guides/cli/managing-environments)

## ✨ Key Features

- ✅ **Multi-tenant architecture** - Each restaurant is isolated
- ✅ **Timezone-aware bookings** - Proper UTC conversion
- ✅ **Conflict prevention** - No double-booking with EXCLUDE constraint
- ✅ **Row Level Security** - Role-based access control
- ✅ **Realistic test data** - 400 bookings across 8 pubs
- ✅ **Fully documented** - Comprehensive README and comments

---

**Happy coding! 🚀**

For questions or issues, check `supabase/README.md` or the troubleshooting section.
