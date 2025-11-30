# Refactoring: Moving Table Business Rules from Database to Code

**Date**: 2025-11-29
**Status**: ✅ Implemented
**Migration**: `20251129163735_remove_business_rule_columns.sql`

## Summary

Moved table party size business rules from database columns (`min_party_size`, `max_party_size`) to code-derived logic based on physical table properties.

## Problem

The original design stored business rules in the database:

- `min_party_size`: Minimum party size allowed for a table
- `max_party_size`: Maximum party size allowed for a table

**Issues**:

1. ❌ Business rules **should be uniform across all restaurants** but were stored per-table
2. ❌ Rules were **duplicated** across hundreds of table records
3. ❌ **No git history** for rule changes
4. ❌ **Inconsistent data** led to bugs (e.g., movable tables with `max_party_size=4` couldn't combine for 11-person parties)
5. ❌ **Over-engineering** for flexibility that wasn't needed

## Solution

### Architecture Change

**Before (Database-driven):**

```sql
table_inventory:
  - capacity: 4
  - min_party_size: 2  -- ❌ Business rule in DB
  - max_party_size: 4  -- ❌ Business rule in DB
  - mobility: "movable"
```

**After (Code-driven):**

```typescript
// Physical properties only in DB
table_inventory:
  - capacity: 4
  - mobility: "movable"

// Business rules derived in code
deriveTableRules({ capacity: 4, mobility: "movable" })
  → { minPartySize: 1, maxPartySize: null, canBeMerged: true }
```

### Business Rules (Uniform)

Implemented in `server/capacity/table-rules.ts`:

**Movable Tables:**

- ✅ `minPartySize = 1`
- ✅ `maxPartySize = null` (unlimited when combined)
- ✅ `canBeMerged = true`
- ✅ Tables can be combined to accommodate larger parties

**Fixed Tables:**

- ✅ `minPartySize = 1`
- ✅ `maxPartySize = capacity` (strict limit)
- ✅ `canBeMerged = false`
- ✅ Cannot be moved or combined

## Changes Made

### 1. Created Business Rule Module

**File**: `server/capacity/table-rules.ts`

```typescript
export function deriveTableRules(table: TablePhysicalProperties): TablePartyRules {
  if (table.mobility === 'movable') {
    return {
      minPartySize: 1,
      maxPartySize: null, // Unlimited - can be combined
      canBeMerged: true,
      requiresAdjacency: true,
    };
  } else {
    return {
      minPartySize: 1,
      maxPartySize: table.capacity, // Strict limit
      canBeMerged: false,
      requiresAdjacency: false,
    };
  }
}
```

### 2. Updated Table Filtering Logic

**File**: `server/capacity/table-assignment/availability.ts`

**Before:**

```typescript
if (partySize > table.maxPartySize) {
  return false; // Reading from DB
}
```

**After:**

```typescript
const rules = deriveTableRules({
  capacity: table.capacity,
  mobility: table.mobility,
  category: table.category,
});

if (partySize > rules.maxPartySize) {
  return false; // Derived from physical properties
}
```

### 3. Deprecated Type Fields

**File**: `server/capacity/table-assignment/types.ts`

Marked `minPartySize` and `maxPartySize` as `@deprecated` with clear migration instructions.

### 4. Updated Database Loaders

**File**: `server/capacity/table-assignment/supabase.ts`

- Removed `min_party_size` and `max_party_size` from SELECT queries
- Set deprecated fields to `undefined` when mapping rows to objects

### 5. Created Migration

**File**: `supabase/migrations/20251129163735_remove_business_rule_columns.sql`

Drops the columns and adds documentation comments explaining the change.

## Migration Path

### Step 1: Update Code (✅ Done)

All code now uses `deriveTableRules()` instead of reading from database

### Step 2: Run Migration

```bash
# After deploying updated code
supabase db push

# Or manually
psql < supabase/migrations/20251129163735_remove_business_rule_columns.sql
```

### Step 3: Update Supabase Types

```bash
npm run generate:types
```

## Benefits

✅ **Single Source of Truth**: Business rules defined once in code
✅ **Version Control**: Changes tracked in git, not database logs
✅ **Consistency**: Impossible to have inconsistent rules across tables
✅ **Simpler Schema**: Fewer columns to maintain
✅ **Testability**: Rules can be unit tested
✅ **Documentation**: Code comments explain the "why"

## Backwards Compatibility

- ⚠️ **Breaking Change**: Requires code deployment before migration
- ✅ **Deprecated Fields**: Still exist in TypeScript types temporarily
- ✅ **Graceful Migration**: Old code will get `undefined` instead of crashing

## Testing

Verify the changes:

```typescript
import { deriveTableRules } from '@/server/capacity/table-rules';

// Test movable table
const movableRules = deriveTableRules({
  capacity: 4,
  mobility: 'movable',
});
// → { minPartySize: 1, maxPartySize: null, canBeMerged: true }

// Test fixed table
const fixedRules = deriveTableRules({
  capacity: 6,
  mobility: 'fixed',
});
// → { minPartySize: 1, maxPartySize: 6, canBeMerged: false }
```

## Future Cleanup

After the migration is deployed to all environments:

1. Remove deprecated fields from `Table` interface
2. Remove database type references to these columns
3. Update any remaining API responses

## Related Issues

Fixes issue where 11-person party couldn't be assigned to 3 movable tables (4+4+4=12 capacity) because each table had `max_party_size=4` stored in database.

## References

- Migration: `supabase/migrations/20251129163735_remove_business_rule_columns.sql`
- Business Rules: `server/capacity/table-rules.ts`
- Updated Logic: `server/capacity/table-assignment/availability.ts`
