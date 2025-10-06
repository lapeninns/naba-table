# Restaurant Listing Error - Fix Summary

## 🔴 Problem

`ListRestaurantsError: [restaurants] failed to load restaurant list` when accessing `/reserve` page.

## ✅ Solution Provided

I've created a comprehensive fix with multiple approaches and verification tools.

## 📁 Files Created/Updated

### 1. **COMPLETE_DATABASE_FIX.sql** ⭐ (Main Fix)

Complete SQL script to fix all RLS policies on the restaurants table.

- Drops all existing policies dynamically
- Creates fresh policies for service_role, authenticated, and anon
- Grants proper permissions
- Includes verification queries
- Optionally includes seed data

**Run this in Supabase SQL Editor**: https://supabase.com/dashboard/project/mqtchcaavsucsdjskptc/sql

### 2. **CHECK_DATABASE_STATE.sql** (Diagnostic)

Diagnostic script to check current database state:

- RLS status
- Current policies
- Table grants
- Restaurant count
- Helper functions

### 3. **SEED_RESTAURANTS.sql** (Sample Data)

Sample restaurant data if your database is empty.

### 4. **DATABASE_FIX_GUIDE.md** (Documentation)

Comprehensive guide explaining:

- Root cause analysis
- Step-by-step fix instructions
- Verification steps
- Common issues and solutions

### 5. **scripts/test-restaurant-listing.ts** (Test Script)

Node.js test script to verify the fix works:

```bash
pnpm tsx scripts/test-restaurant-listing.ts
```

### 6. **server/restaurants/listRestaurants.ts** (Updated)

Enhanced error logging to show detailed Supabase errors.

### 7. **supabase/migrations/20241006000002_allow_public_restaurant_read.sql** (Updated)

Improved migration with dynamic policy dropping to avoid conflicts.

## 🚀 Quick Start - How to Fix

### Option A: One-Click Fix (Recommended)

1. **Open Supabase SQL Editor**
   - URL: https://supabase.com/dashboard/project/mqtchcaavsucsdjskptc/sql

2. **Copy and paste `COMPLETE_DATABASE_FIX.sql`**
   - Run the entire script
   - Check the output for any errors

3. **If no restaurants exist**, run `SEED_RESTAURANTS.sql`

4. **Test your application**
   ```bash
   pnpm run dev
   ```
   Navigate to http://localhost:3000/reserve

### Option B: Use Test Script

```bash
# Test the database connection and query
pnpm tsx scripts/test-restaurant-listing.ts
```

This will show you:

- ✅ If connection works
- ✅ Number of restaurants
- ✅ If the query succeeds
- ❌ Detailed error if it fails

## 🔍 Root Cause

The issue occurs because:

1. **RLS is enabled** on the `restaurants` table
2. **Initial policy** only allowed users in `restaurant_memberships` to view restaurants
3. **Service role** (used by `getServiceSupabaseClient()`) was being blocked
4. The `/reserve` page needs **public access** to list all restaurants

## ✨ What the Fix Does

### Before (Broken)

```sql
-- Only this policy existed:
CREATE POLICY "Users can view their restaurants"
  ON public.restaurants FOR SELECT
  USING (id IN (SELECT public.user_restaurants()));
```

This blocked service_role because it doesn't have a user context.

### After (Fixed)

```sql
-- Service role gets full access
CREATE POLICY "service_role_all_access"
  ON public.restaurants FOR ALL
  TO service_role
  USING (true);

-- Anonymous can browse
CREATE POLICY "anon_read_all"
  ON public.restaurants FOR SELECT
  TO anon
  USING (true);

-- Authenticated can browse
CREATE POLICY "authenticated_read_all"
  ON public.restaurants FOR SELECT
  TO authenticated
  USING (true);

-- Admins/owners can still update/delete (existing policies)
```

## 🧪 Verification Checklist

After applying the fix:

- [ ] Run `CHECK_DATABASE_STATE.sql` - should show 3 SELECT policies
- [ ] Run `pnpm tsx scripts/test-restaurant-listing.ts` - should succeed
- [ ] Visit `/reserve` page - should show restaurant list
- [ ] Check browser console - no errors
- [ ] Check terminal - detailed error logging (if any issues)

## 🔧 Troubleshooting

### "No restaurants found"

- Run `SEED_RESTAURANTS.sql` to add sample data

### Still getting errors

- Check the detailed error in console (now includes code, message, details, hint)
- Run `CHECK_DATABASE_STATE.sql` to see current policies
- Verify `.env.local` has correct `SUPABASE_SERVICE_ROLE_KEY`

### Policies still conflicting

- The fix uses dynamic SQL to drop ALL SELECT policies first
- If needed, drop all policies manually and re-run the fix

## 📊 Expected Results

After fix:

```bash
✅ RLS enabled: true
✅ Policies: 6 total
   - 3 SELECT policies (service_role, anon, authenticated)
   - 1 INSERT policy (authenticated)
   - 1 UPDATE policy (owners/admins)
   - 1 DELETE policy (owners)
✅ Grants: SELECT for anon, authenticated, service_role
✅ Query: SELECT id,name,slug,timezone,capacity FROM restaurants
```

## 🎯 Next Steps

1. **Apply the fix**: Run `COMPLETE_DATABASE_FIX.sql`
2. **Verify**: Run test script or check `/reserve` page
3. **Add data**: If needed, run `SEED_RESTAURANTS.sql`
4. **Monitor**: Check enhanced error logs if any issues persist

## 📝 Notes

- The fix maintains existing UPDATE/DELETE restrictions
- Only SELECT operations are made public
- Service role needs full access for server-side operations
- Migration file updated to prevent future conflicts

---

**All tools provided - ready to fix! Run `COMPLETE_DATABASE_FIX.sql` in Supabase SQL Editor to resolve the issue.**
