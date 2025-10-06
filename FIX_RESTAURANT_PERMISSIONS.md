# Fix for ListRestaurantsError - Permission Denied

## Problem

The `/reserve` page is failing with a "permission denied for table restaurants" error because the Row Level Security (RLS) policy on the `restaurants` table only allows users to view their own restaurants.

## Root Cause

The current RLS policy:

```sql
CREATE POLICY "Users can view their restaurants"
  ON public.restaurants FOR SELECT
  USING (id IN (SELECT public.user_restaurants()));
```

This policy restricts restaurant viewing to only restaurants where the user has a membership. However, the `/reserve` page needs to list **all** restaurants for public browsing and booking.

## Solution

We need to allow public (anonymous and authenticated) read access to the restaurants table.

### Steps to Fix:

1. **Go to your Supabase Dashboard**: https://supabase.com/dashboard/project/mqtchcaavsucsdjskptc

2. **Navigate to SQL Editor**:
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Run this SQL**:

   ```sql
   -- Drop the existing restrictive policy
   DROP POLICY IF EXISTS "Users can view their restaurants" ON public.restaurants;

   -- Create a new policy that allows anyone (authenticated or anonymous) to view all restaurants
   CREATE POLICY "Anyone can view restaurants"
     ON public.restaurants FOR SELECT
     TO public
     USING (true);
   ```

4. **Click "Run"** to execute the SQL

5. **Verify the fix**:
   - Refresh your application at http://localhost:3000/reserve
   - The page should now load the restaurant list successfully

### Alternative: Use Supabase CLI (if you prefer)

If you have the Supabase CLI configured:

```bash
npx supabase migration up --db-url "your-direct-connection-string"
```

The migration file has already been created at:
`supabase/migrations/20241006000002_allow_public_restaurant_read.sql`

## Security Considerations

- ✅ This is safe for a restaurant reservation system - customers need to see all restaurants
- ✅ Write operations (INSERT/UPDATE/DELETE) remain protected
- ✅ Only the SELECT (read) permission is public
- ✅ Sensitive restaurant data should be controlled at the column level if needed

## Testing

After applying the fix, verify that:

1. The `/reserve` page loads without errors
2. All restaurants are displayed
3. Clicking on a restaurant takes you to the booking flow
