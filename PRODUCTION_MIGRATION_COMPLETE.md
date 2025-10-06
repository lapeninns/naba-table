# Production Migration Complete ✅

## Migration Status

### ✅ Phase 1: Schema Migration

- **Status**: COMPLETE
- **Date**: October 6, 2025
- **Migration**: `20241006000001_initial_schema.sql`
- **Result**: Successfully applied to production database
- **Details**: All tables, types, triggers, RLS policies, and indexes created

### 🔄 Phase 2: Seed Data (Next Step)

To complete the setup, you need to run the seed data in production:

1. **Open Supabase SQL Editor**:
   - URL: https://supabase.com/dashboard/project/mqtchcaavsucsdjskptc/sql/new
   - Or run: `open "https://supabase.com/dashboard/project/mqtchcaavsucsdjskptc/sql/new"`

2. **Copy the seed script**:
   - Open: `supabase/seed.sql`
   - Copy all contents (177 lines)

3. **Paste and Run**:
   - Paste into the SQL Editor
   - Click "Run" button
   - Wait for completion (~10 seconds)

4. **Verify**:

   ```sql
   -- Check restaurants
   SELECT COUNT(*) FROM restaurants;  -- Should be 8

   -- Check bookings
   SELECT COUNT(*) FROM bookings;     -- Should be 400

   -- Check no overlaps
   SELECT COUNT(*) FROM bookings
   WHERE status IN ('confirmed','pending')
   GROUP BY table_id
   HAVING COUNT(*) > 1;               -- Should be 0 rows
   ```

## Production Configuration

### Environment Variables

Your `.env.local` is already configured for production:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://mqtchcaavsucsdjskptc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### Default Restaurant

After seeding, update your default restaurant ID:

1. Run in SQL Editor:

   ```sql
   SELECT id FROM restaurants WHERE slug = 'the-queen-elizabeth-pub';
   ```

2. Update `.env.local`:
   ```bash
   BOOKING_DEFAULT_RESTAURANT_ID=<paste-the-id-here>
   ```

## What Was Deployed

### Database Objects Created:

- **Tables**: 5 (restaurants, restaurant_memberships, customers, restaurant_tables, bookings)
- **Enums**: 3 (booking_status, seating_type, seating_preference_type)
- **Functions**: 4 (update_updated_at, generate_booking_reference, set_booking_reference, set_booking_instants, user_restaurants)
- **Triggers**: 6 (auto-update timestamps, booking references, timezone conversions)
- **Indexes**: 17 (optimized for queries)
- **RLS Policies**: 15 (multi-tenant security)
- **Constraints**: 2 (EXCLUDE for overlap prevention, CHECK for time order)

### Seed Data (Pending):

- **Restaurants**: 8 pubs
- **Tables**: 96 (12 per pub)
- **Customers**: 640 (80 per pub)
- **Bookings**: 400 (50 per pub)
  - 15 past bookings
  - 5 today bookings
  - 30 future bookings

### Features:

- ✅ Multi-tenant with RLS
- ✅ Timezone-aware bookings (IANA timezones)
- ✅ Overlap prevention (EXCLUDE constraint)
- ✅ Auto-generated booking references (10-char codes)
- ✅ Optimized indexes for performance
- ✅ Comprehensive security policies

## Next Steps

1. **Seed the database** (see Phase 2 above)
2. **Test authentication** with real email (no more Inbucket!)
3. **Verify booking system** works end-to-end
4. **Update default restaurant ID** in `.env.local`

## Rollback (If Needed)

If you need to revert the migration:

```bash
# WARNING: This will delete ALL data in public schema
supabase db reset --db-url postgresql://postgres.mqtchcaavsucsdjskptc:[YOUR-PASSWORD]@aws-0-eu-west-2.pooler.supabase.com:6543/postgres
```

## Support

- Supabase Dashboard: https://supabase.com/dashboard/project/mqtchcaavsucsdjskptc
- SQL Editor: https://supabase.com/dashboard/project/mqtchcaavsucsdjskptc/sql
- Table Editor: https://supabase.com/dashboard/project/mqtchcaavsucsdjskptc/editor
- Auth Settings: https://supabase.com/dashboard/project/mqtchcaavsucsdjskptc/auth/users

---

**Migration applied successfully!** 🎉

Complete Phase 2 (seed data) to finish the setup.
