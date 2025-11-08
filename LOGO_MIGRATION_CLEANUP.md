# Logo URL Migration - Cleanup Summary

## Migration Status

✅ **Migration Applied**: `20251107183000_add_restaurant_logo.sql`
✅ **Column Added**: `restaurants.logo_url` (text, nullable)
✅ **Migration Recorded**: Marked as applied in Supabase migration history

## Verification

```sql
-- Column exists in schema
\d public.restaurants
-- Shows: logo_url | text | | |
```

## Files to Clean Up

Now that the `logo_url` column exists in all environments, the compatibility shims can be removed:

### 1. Delete Compatibility Utilities File

- **File**: `server/restaurants/logo-url-compat.ts`
- **Functions**:
  - `isLogoUrlColumnMissing()`
  - `ensureLogoColumnOnRow()`
  - `ensureLogoColumnOnRows()`
  - `logLogoColumnFallback()`

### 2. Remove Fallback Logic from Files

#### Files with fallback logic to clean:

1. `server/restaurants/create.ts` (lines 144-148)
2. `server/restaurants/update.ts` (line 143+)
3. `server/restaurants/details.ts` (line 108+)
4. `server/restaurants/list.ts` (line 86+)
5. `server/emails/bookings.ts` (line 73+)
6. `src/app/api/ops/restaurants/[id]/route.ts` (line 87+)
7. `scripts/preview-booking-email.ts` (line 75+)

### Pattern to Remove

**Before (with fallback)**:

```typescript
import {
  ensureLogoColumnOnRow,
  isLogoUrlColumnMissing,
  logLogoColumnFallback,
} from '@/server/restaurants/logo-url-compat';

let { data, error } = await query.select('*, logo_url');

if (error && isLogoUrlColumnMissing(error)) {
  logLogoColumnFallback('context');
  ({ data, error } = await query.select('* (excluding logo_url)'));
  data = ensureLogoColumnOnRow(data);
}
```

**After (direct query)**:

```typescript
// Remove import
const { data, error } = await query.select('*, logo_url');
// Remove fallback logic entirely
```

## Next Steps

1. ✅ Migration applied and verified
2. ⏭️ Remove `server/restaurants/logo-url-compat.ts`
3. ⏭️ Clean up 7 files that use the compatibility functions
4. ⏭️ Test that logo_url works in all queries
5. ⏭️ Deploy changes

## Benefits After Cleanup

- ✅ Simpler code (no fallback logic)
- ✅ Fewer database queries (no retry logic)
- ✅ Better performance (single query instead of conditional retry)
- ✅ Cleaner error handling
- ✅ Reduced bundle size

---

**Status**: Migration applied ✅  
**Ready for cleanup**: YES  
**Safe to remove shims**: YES (column exists in database)
