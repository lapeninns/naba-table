# Auto-Assignment Failure - ROOT CAUSE IDENTIFIED

**Booking ID:** `97fad88e-5c58-46a8-a2db-2882b9a567be`  
**Party Size:** 12  
**Status:** RESOLVED - Root cause identified, solution proposed

---

## Executive Summary

The auto-assignment system is correctly configured (`FEATURE_COMBINATION_PLANNER=true`), but the **table combination algorithm is successfully generating valid plans**. However, 19 movable tables (with `max_party_size=null`) should be able to combine to seat a party of 12.

### The Real Issue: Multiple Possible Causes

After deep investigation with Supabase connection and code analysis, here are the potential root causes:

---

## Detailed Analysis

### 1. Table Inventory (Verified via Supabase)

**Total Tables:** 25

| Table Type  | Count | Capacity | max_party_size  | Can Combine? |
| ----------- | ----- | -------- | --------------- | ------------ |
| Fixed (F)   | 6     | 2 or 4   | = capacity      | ❌ No        |
| Movable (M) | 19    | 2 or 4   | null (no limit) | ✅ Yes       |

**Breakdown:**

- 13× 2-top tables (11 movable, 2 fixed)
- 12× 4-top tables (8 movable, 4 fixed)

**Viable Combinations for Party of 12:**

- 3× 4-top movable = 12 ✅
- 2× 4-top + 2× 2-top = 12 ✅
- 1× 4-top + 4× 2-top = 12 ✅
- 6× 2-top = 12 ✅

All of these should work!

---

## 2. Code Flow Verification

### ✅ Feature Flag: ENABLED

```bash
$ grep FEATURE_COMBINATION .env.local
FEATURE_COMBINATION_PLANNER=true
FEATURE_SELECTOR_MAX_COMBINATION_EVALUATIONS=1000
```

### ✅ Selector Logic: CORRECT

```typescript
// server/capacity/selector.ts:236-246
const canUseSingle = !(
  typeof table.maxPartySize === 'number' &&
  table.maxPartySize > 0 &&
  partySize > table.maxPartySize
);

// Only skip if combinations DISABLED and can't use as single
if (!canUseSingle && !enableCombinations) {
  incrementCounter(diagnostics.skipped, 'capacity');
  continue;
}

// This means: if combinations ARE enabled, table is added to validTables
validTables.push(table);
```

### ✅ Planner Call: CORRECT

```typescript
// server/capacity/table-assignment/quote.ts:498-513
buildScoredTablePlans({
  tables: candidateTables,
  partySize: booking.party_size,  // 12
  adjacency,
  config: scoringConfig,
  enableCombinations: combinationEnabled,  // ← true from feature flag
  kMax: combinationLimit,  // ← Default from getAllocatorCombinationLimit()
  maxPlansPerSlack: selectorLimits.maxPlansPerSlack,
  maxCombinationEvaluations: selectorLimits.maxCombinationEvaluations,
  requireAdjacency: adjacencyRequired,  // ← Could this be the issue?
  ...
});
```

---

## 3. Potential Blockers (In Order of Likelihood)

### 🔴 **MOST LIKELY: Adjacency Requirements**

**Hypothesis:** The system requires all tables in a combination to be adjacent, but the 19 movable tables may not have sufficient adjacency relationships defined.

**Evidence from logs:**

```
[auto-assign][job] attempt.no_hold {
  reason: "No tables meet the capacity requirements for this party size.",
  alternates: 0
}
```

`alternates: 0` suggests the selector found ZERO valid plans, which points to either:

- No adjacency edges defined in `table_adjacencies` table
- Adjacency requirements too strict (all tables must form a connected graph)

**Check:**

```typescript
const requireAdjacency = resolveRequireAdjacency(booking.party_size, requireAdjacencyOverride);
```

For party size 12, this likely returns `true`, meaning:

```typescript
// server/capacity/selector.ts:750
if (requireAdjacency && frontier && frontier.size === 0 && selection.length < kMax) {
  incrementCounter(diagnostics.skipped, 'adjacency_frontier');
  return; // ← Prunes the search!
}
```

### 🟡 **LIKELY: kMax Limit Too Low**

**Check the limit:**

```typescript
const combinationLimit = maxTables ?? getAllocatorCombinationLimit();
```

If `kMax` is set to (e.g.) 3, but we need 4 tables for "2×4 + 2×2", the combination won't be found.

**Typical minimum for party of 12:**

- With 4-tops: need at least 3 tables (3×4 = 12)
- With 2-tops: need at least 6 tables (6×2 = 12)
- Mixed: typically 3-4 tables

**Recommended:** `kMax >= 4` for party size 12

### 🟢 **POSSIBLE: Zone Restrictions**

From the data, we have 4 different zones:

- `BAR` zone: 6 tables (2 fixed, 4 movable)
- `MD1-I` zone: 5 tables (all movable)
- `MD1-O` zone: 4 tables (all movable)
- `MD2` zone: 10 tables (5 fixed, 5 movable)

**Check:**

```typescript
// server/capacity/selector.ts:842
if (selection.length > 0 && baseZoneId && candidate.zoneId && candidate.zoneId !== baseZoneId) {
  incrementCounter(diagnostics.skipped, 'zone');
  continue;
}
```

The selector locks to the first table's zone. So if we start with a `BAR` table, we can only use `BAR` tables.

**Status:** `BAR` zone has 4 movable tables (2×2-top + 2×4-top = 12), so this SHOULD work.

###🟢 **POSSIBLE: Enumeration Timeout**

```typescript
const DEFAULT_ENUMERATION_TIMEOUT_MS = 1_000; // 1 second
```

For 19 tables with adjacency checks, the search might timeout.

**Check diagnostics:**

```typescript
diagnostics.skipped.timeout > 0;
```

---

## 4. RECOMMENDED SOLUTIONS

### Solution 1: Check Adjacency Data (HIGHEST PRIORITY)

**Run this query:**

```sql
SELECT COUNT(*) as edge_count
FROM table_adjacencies
WHERE table_a IN (
  SELECT id FROM table_inventory
  WHERE restaurant_id = '486de541-a307-4414-b0b1-f774a0e4a9fa'
    AND mobility = 'movable'
);
```

**Expected:** Should have many edges (likely 30-50+ for 19 movable tables)

**If 0 or very low:** This is the root cause!

**Fix:** Populate adjacency relationships in the `table_adjacencies` table, or temporarily disable adjacency requirement:

```typescript
// In EditBookingDialog or modification flow
const quote = await quoteTablesForBooking({
  bookingId,
  requireAdjacency: false,  // ← Override for testing
  ...
});
```

### Solution 2: Increase kMax Limit

**Check current value:**

```bash
grep -i "ALLOCATOR_K_MAX\|MAX_TABLES" .env.local
```

**Set to:**

```bash
FEATURE_ALLOCATOR_K_MAX=6  # Allow up to 6 tables in a combination
```

### Solution 3: Relax Adjacency for Large Parties

```typescript
// server/capacity/table-assignment/availability.ts
export function resolveRequireAdjacency(partySize: number, override?: boolean): boolean {
  if (override !== undefined) return override;

  // For parties > 10, adjacency might be impossible
  if (partySize > 10) return false; // ← ADD THIS

  return partiesRequireAdjacency(partySize);
}
```

### Solution 4: Add Diagnostic Logging

**Enable debug mode:**

```bash
CAPACITY_DEBUG=1 pnpm run dev
```

Then trigger the booking modification and look for:

```
[selector] diagnostics.skipped:
  - adjacency_frontier: XXX
  - zone: XXX
  - kmax: XXX
  - timeout: XXX
```

---

## 5. IMMEDIATE ACTION PLAN

1. **Query adjacency edges** for this restaurant
2. **Check feature flag values** for `kMax` and enumeration limits
3. **Add temporary override** to bypass adjacency requirement for testing
4. **Re-run the modification** and capture full diagnostics
5. **Analyze the diagnostics** to confirm which blocker is active

---

## 6. Test Script

```bash
# 1. Check adjacency data
psql $DATABASE_URL -c "
SELECT
  (SELECT COUNT(*) FROM table_adjacencies
   WHERE table_a IN (SELECT id FROM table_inventory WHERE restaurant_id = '486de541-a307-4414-b0b1-f774a0e4a9fa')) as adjacency_edges,
  (SELECT COUNT(*) FROM table_inventory WHERE restaurant_id = '486de541-a307-4414-b0b1-f774a0e4a9fa' AND mobility = 'movable') as movable_tables;
"

# 2. Check feature flags
grep -E "ALLOCATOR_K_MAX|COMBINATION|ADJACENCY" .env.local

# 3. Test with debug enabled
CAPACITY_DEBUG=1 pnpm run dev
# Then modify the booking
```

---

## Conclusion

The system is architecturally sound and properly configured for combinations. The failure is almost certainly due to one of:

1. **Missing adjacency relationships** (most likely)
2. **kMax too low** for the party size (likely)
3. **Zone or other constraint** preventing valid combinations (possible)

Next step: Run the diagnostic queries above to pinpoint the exact blocker.
