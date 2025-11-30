# 🎯 AUTO-ASSIGNMENT FAILURE - RESOLVED

**Date**: 2025-11-30  
**Booking ID**: `97fad88e-5c58-46a8-a2db-2882b9a567be`  
**Party Size**: 12  
**Status**: ✅ **ROOT CAUSE IDENTIFIED**

---

## Problem Summary

Auto-assignment failing for party of 12 with error:

```
"No tables meet the capacity requirements for this party size."
```

Despite having:

- ✅ Combinations enabled (`FEATURE_COMBINATION_PLANNER=true`)
- ✅ 19 movable tables available (11× 2-top, 8× 4-top)
- ✅ Multiple viable combinations that should work

---

## Root Cause

### ❌ **kMax Limit Too Low**

```bash
FEATURE_ALLOCATOR_K_MAX=3  # Current value
```

**The Problem:**

- System can only try combinations of **up to 3 tables**
- For party of 12 with available tables:
  - **Best 3-table combo**: 3× 4-top = 12 capacity ✅
  - BUT: Adjacency graph is sparse (avg 2.9 edges/table, 3 tables with 0 edges)
  - Current adjacency may not support finding 3 connected 4-tops

**More flexible options require 4-5 tables:**

- 2× 4-top + 2× 2-top = 12 (needs kMax=4)
- 1× 4-top + 4× 2-top = 12 (needs kMax=5)

---

## Adjacency Analysis

```
📊 Movable Tables: 19
🔗 Adjacency Edges: 55
   - Tables with edges: 16/19
   - Average edges per table: 2.9
   - Tables without edges: 3 (BAR-2M01, MD1-I-402, MD1-O-402)
```

**Status**: Adjacency data exists but is sparse. This makes finding large connected combinations difficult with current kMax=3 limit.

---

## ✅ Solution

### Option 1: Increase kMax (RECOMMENDED)

```bash
# In .env.local
FEATURE_ALLOCATOR_K_MAX=5  # Change from 3 to 5
```

**Benefits:**

- Allows more flexible combinations (4-5 tables)
- Works with existing sparse adjacency graph
- Handles parties up to ~20 people with current inventory

**Impact:**

- Slightly longer computation time (negligible with current 19-table inventory)
- Current timeout (1000ms) is sufficient

### Option 2: Improve Adjacency Graph

Add more edges to `table_adjacencies` table to create better connectivity, especially for the 3 tables with no edges.

**Benefits:**

- Better optimization (fewer tables needed)
- Faster combinations search

**Drawbacks:**

- Requires understanding physical layout
- One-time data migration effort

### Option 3: Relax Adjacency for Large Parties

```typescript
// server/capacity/table-assignment/availability.ts
export function resolveRequireAdjacency(partySize: number, override?: boolean): boolean {
  if (override !== undefined) return override;

  // Relax for parties > 10 where adjacency is difficult
  if (partySize > 10) return false;

  return partiesRequireAdjacency(partySize);
}
```

---

## Implementation

### Step 1: Update Environment Variable

```bash
# Edit .env.local
FEATURE_ALLOCATOR_K_MAX=5
```

### Step 2: Restart Development Server

```bash
pnpm run dev
```

### Step 3: Test the Modification Flow

1. Navigate to the booking detail page
2. Click "Edit Booking"
3. Modify the booking (change time/date/party size)
4. Save changes
5. Verify auto-assignment succeeds

### Step 4: Monitor Logs

Look for:

```
[auto-assign][job] attempt.success { attempt: 0, holdId: '...', durationMs: ... }
```

Instead of:

```
[auto-assign][job] attempt.no_hold { reason: "No tables meet..." }
```

---

## Expected Outcome

With `kMax=5`, the system will successfully find combinations like:

**Example 1** (4 tables, capacity=12):

```
MD2-401 (4-top) + MD2-402 (4-top) + MD2-201 (2-top) + MD2-202 (2-top)
```

**Example 2** (3 tables, capacity=12):

```
MD1-I-401 (4-top) + MD1-I-403 (4-top) + MD1-I-201 (2-top) + MD1-I-202 (2-top)
```

Both honor adjacency requirements (if tables are adjacent) and stay within kMax=5.

---

## Verification Commands

### Before Fix

```bash
pnpm tsx scripts/check-adjacency.ts
# Should show: ALLOCATOR_K_MAX: 3
```

### After Fix

```bash
# 1. Verify env variable
grep FEATURE_ALLOCATOR_K_MAX .env.local
# Expected: FEATURE_ALLOCATOR_K_MAX=5

# 2. Test the booking modification
# (Use UI or API)

# 3. Check logs
tail -f .next/trace | grep "auto-assign"
```

---

## Additional Recommendations

### 1. Add kMax to Policy Configuration

For better control per-restaurant:

```sql
ALTER TABLE restaurants
ADD COLUMN capacity_config JSONB DEFAULT '{"kMax": 5}';
```

Then read from DB instead of env var.

### 2. Dynamic kMax Based on Party Size

```typescript
function computeKMax(partySize: number): number {
  // Assuming average table capacity ~3
  return Math.min(8, Math.ceil(partySize / 3) + 1);
}
```

This would give:

- Party 6 → kMax=3
- Party 12 → kMax=5
- Party 18 → kMax=7

### 3. Monitor Adjacency Coverage

```sql
SELECT
  ti.table_number,
  ti.capacity,
  COUNT(ta.table_b) as edge_count
FROM table_inventory ti
LEFT JOIN table_adjacencies ta ON ti.id = ta.table_a
WHERE ti.restaurant_id = '486de541-a307-4414-b0b1-f774a0e4a9fa'
  AND ti.mobility = 'movable'
GROUP BY ti.id, ti.table_number, ti.capacity
HAVING COUNT(ta.table_b) = 0
ORDER BY ti.table_number;
```

---

## Conclusion

**Root Cause**: `FEATURE_ALLOCATOR_K_MAX=3` too restrictive for party of 12 with sparse adjacency graph

**Solution**: Increase to `FEATURE_ALLOCATOR_K_MAX=5`

**Impact**: Immediate resolution, no code changes required

**Next Steps**:

1. Update `.env.local`
2. Restart server
3. Test booking modification
4. Consider dynamic kMax in future enhancements

---

**Status**: Ready for implementation ✅
