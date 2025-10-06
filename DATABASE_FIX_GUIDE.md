# Database Fix Guide - Restaurant Listing Error

## Problem

The `/reserve` page is failing with `ListRestaurantsError` because the Supabase Row Level Security (RLS) policies are blocking the service role from reading the `restaurants` table.

## Root Cause

1. The `restaurants` table has RLS enabled
2. The initial migration created a policy "Users can view their restaurants" that only allows users who are members
3. The service role (used by `listRestaurants()`) is being blocked by this policy
4. Migration `20241006000002` attempted to add public policies but there may be conflicts

## Solution - Step by Step

### Option 1: Quick Fix (Use the Complete Fix Script)

1. **Open Supabase SQL Editor**
   - Go to: https://supabase.com/dashboard/project/mqtchcaavsucsdjskptc/sql

2. **Run the diagnostic script first** (to see current state)
   - Copy contents of `CHECK_DATABASE_STATE.sql`
   - Paste and run in SQL Editor
   - Review the output to understand current policies

3. **Run the complete fix**
   - Copy contents of `COMPLETE_DATABASE_FIX.sql`
   - Paste and run in SQL Editor
   - This will:
     - Drop all existing policies on restaurants
     - Create fresh policies for service_role, authenticated, and anon
     - Grant proper permissions
     - Verify the setup

4. **Test the application**
   ```bash
   pnpm run dev
   ```

   - Navigate to http://localhost:3000/reserve
   - The restaurant list should now load

### Option 2: Reset Database with Migrations

If you want a completely fresh start:

1. **Drop and recreate the schema**

   ```sql
   DROP SCHEMA IF EXISTS public CASCADE;
   CREATE SCHEMA public;
   GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;
   ```

2. **Run migrations in order**
   - First: `supabase/migrations/20241006000001_initial_schema.sql`
   - Then: `supabase/migrations/20241006000002_allow_public_restaurant_read.sql`

3. **Seed sample data** (if you don't have restaurants)
   ```sql
   INSERT INTO public.restaurants (name, slug, timezone, capacity) VALUES
     ('Sample Restaurant', 'sample-restaurant', 'America/New_York', 50),
     ('Test Venue', 'test-venue', 'Europe/London', 100),
     ('Demo Eatery', 'demo-eatery', 'Asia/Tokyo', 75);
   ```

## Verification

After applying the fix, verify with these checks:

### 1. Check RLS Status

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'restaurants';
```

Expected: `rowsecurity = true`

### 2. Check Policies

```sql
SELECT policyname, roles::text[], cmd
FROM pg_policies
WHERE tablename = 'restaurants';
```

Expected policies:

- `service_role_all_access` (or `service_role_read_all`) for service_role
- `anon_read_all` for anon
- `authenticated_read_all` for authenticated

### 3. Test Query

```sql
SELECT id, name, slug FROM public.restaurants LIMIT 5;
```

Should return restaurants without error.

### 4. Test Application

```bash
pnpm run dev
```

Navigate to `/reserve` - should show restaurant list.

## Understanding the Fix

### What Changed

**Before (Broken):**

- Only policy: "Users can view their restaurants"
- Required user to be in `restaurant_memberships`
- Service role was blocked because it doesn't have a user context

**After (Fixed):**

- Service role: Full access (`USING (true)`)
- Authenticated users: Can read all restaurants
- Anonymous users: Can read all restaurants (for public browsing)
- Admins/Owners: Can still update/delete their restaurants

### Why This Works

1. **Service Role**: The application uses `getServiceSupabaseClient()` which uses the service role key. This role needs unrestricted access to read restaurants.

2. **Public Browsing**: The `/reserve` page needs to show all restaurants to anyone (logged in or not), so both `authenticated` and `anon` roles need read access.

3. **Write Protection**: The UPDATE and DELETE policies still restrict modifications to only restaurant owners/admins.

## Enhanced Error Logging

The code has been updated to log detailed error information:

```typescript
console.error('[listRestaurants] Supabase error details:', {
  code: error.code,
  message: error.message,
  details: error.details,
  hint: error.hint,
});
```

This will help diagnose any future issues.

## Files Modified

1. ✅ `COMPLETE_DATABASE_FIX.sql` - Complete fix script
2. ✅ `CHECK_DATABASE_STATE.sql` - Diagnostic script
3. ✅ `supabase/migrations/20241006000002_allow_public_restaurant_read.sql` - Updated migration
4. ✅ `server/restaurants/listRestaurants.ts` - Enhanced error logging

## Next Steps

1. Run `COMPLETE_DATABASE_FIX.sql` in Supabase SQL Editor
2. Restart your dev server: `pnpm run dev`
3. Test `/reserve` page
4. If still having issues, check the console for detailed error messages
5. Run `CHECK_DATABASE_STATE.sql` to diagnose

## Common Issues

### "No restaurants found"

- Run the seed data INSERT statement
- Check if restaurants exist: `SELECT count(*) FROM restaurants;`

### Still getting errors

- Check the console for the detailed error message
- Verify service role key is correct in `.env.local`
- Ensure you ran the complete fix script
- Try resetting the database completely (Option 2)

### Policies conflict

- The fix script uses dynamic SQL to drop ALL existing SELECT policies
- This prevents conflicts from previous policy names

## Support

If you continue to experience issues:

1. Run `CHECK_DATABASE_STATE.sql` and share the output
2. Check browser console and terminal for error details
3. Verify environment variables are set correctly
