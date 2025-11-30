# Auto-Assignment Failure Analysis

**Booking ID:** `97fad88e-5c58-46a8-a2db-2882b9a567be`  
**Issue:** Auto-assignment failing for party size 12  
**Error:** "No tables meet the capacity requirements for this party size."

---

## 1. Booking Details

```json
{
  "id": "97fad88e-5c58-46a8-a2db-2882b9a567be",
  "restaurant_id": "486de541-a307-4414-b0b1-f774a0e4a9fa",
  "party_size": 12,
  "booking_date": "2025-12-11",
  "start_time": "12:45:00",
  "status": "pending",
  "pending_admin_reason": "hard.no_tables"
}
```

---

## 2. Table Inventory Analysis

**Total Tables:** 25  
**Single-Table Matches:** 0 (no table has capacity ≥ 12)  
**Potential Combination Contributors:** 25

### Table Breakdown by Capacity:

| Capacity | Count | Fixed (max_party_size) | Flexible (max=none) |
| -------- | ----- | ---------------------- | ------------------- |
| 2        | 13    | 2                      | 11                  |
| 4        | 12    | 4                      | 8                   |

### Tables Blocked by max_party_size:

- `BAR-2F01`: capacity=2, max_party_size=2
- `BAR-4F01`: capacity=4, max_party_size=4
- `BAR-4F02`: capacity=4, max_party_size=4
- `MD2-2F01`: capacity=2, max_party_size=2
- `MD2-4F01`: capacity=4, max_party_size=4
- `MD2-4F02`: capacity=4, max_party_size=4

---

## 3. ROOT CAUSE IDENTIFIED

### The Issue

In `/server/capacity/selector.ts` **lines 236-246**:

```typescript
// FIX: maxPartySize should only apply to single-table assignments, not combinations
// For combinations, we need to allow tables with maxPartySize < partySize
// because they can be combined with other tables to meet the party size
const canUseSingle = !(
  typeof table.maxPartySize === 'number' &&
  table.maxPartySize > 0 &&
  partySize > table.maxPartySize
);

// Skip this table entirely only if it also can't contribute to combinations
// (e.g., if combinations are disabled AND it violates maxPartySize for singles)
if (!canUseSingle && !enableCombinations) {
  incrementCounter(diagnostics.skipped, 'capacity');
  continue;
}
```

**THE BUG:** When `enableCombinations` is `false` (which is the default when not explicitly set), all tables with `max_party_size < 12` **ARE BEING EXCLUDED** from consideration.

However, looking at the logs:

```
[auto-assign][job] attempts.reduced.inline_no_capacity
```

This indicates that the inline check (`quoteTablesForBooking`) returned `hard.no_tables`, which triggers the system to reduce max attempts to 1.

---

## 4. Call Stack Analysis

### Flow from Modification Request → Auto-Assignment:

1. **EditBookingDialog** → `PUT /api/bookings/{id}`
2. **API Route** → `server/bookings/modification-flow.ts`
3. **modification-flow** → `autoAssignAndConfirmIfPossible()`
4. **auto-assign job** → `quoteTablesForBooking()`
5. **quoteTablesForBooking** → `findSuitableTables()`
6. **findSuitableTables** → `buildScoredTablePlans()` in `server/capacity/selector.ts`

### The Problem in the Call Chain:

In `quoteTablesForBooking` (from `server/capacity/table-assignment.ts`):

```typescript
const quote = await quoteTablesForBooking({
  bookingId,
  created By: undefined,
  holdTtlSeconds: 180,
  requireAdjacency: plannerOptions.requireAdjacency,  // ❓ Is this being set correctly?
  maxTables: plannerOptions.maxTables,                 // ❓ Is this limiting combinations?
});
```

**Key Question: What is `enableCombinations` parameter being set to?**

---

## 5. Verification Needed

### Check 1: Is `enableCombinations` being passed to the selector?

Need to check in `/server/capacity/table-assignment/planner.ts` or equivalent:

```typescript
const { plans } = buildScoredTablePlans({
  tables: availableTables,
  partySize: booking.party_size,
  adjacency,
  config: policy.selector,
  enableCombinations: ???,  // ← IS THIS TRUE?
  kMax: options.maxTables,
  ...
});
```

### Check 2: What is the default maxTables limit?

From the auto-assign logs:

```
[auto-assign][job] attempt.no_hold {
  reason: "No tables meet the capacity requirements for this party size.",
  alternates: 0
}
```

The fact that `alternates: 0` suggests the selector found ZERO plans, which means either:

1. `enableCombinations` is `false`
2. `maxTables` is set to `1` (blocking combinations)
3. All tables are being filtered out by the `maxPartySize` check

---

## 6. Recommended Fix

### Option A: Fix in `selector.ts` (lines 236-246)

Change the logic to:

```typescript
// Check if table can be used as a SINGLE table
const canUseSingle =
  capacity >= partySize &&
  (table.minPartySize === null || partySize >= table.minPartySize) &&
  (table.maxPartySize === null || partySize <= table.maxPartySize);

// For combinations, we only need:
// 1. Capacity > 0
// 2. Meets minPartySize (if set)
// maxPartySize should NOT block a table from being used in combinations

if (!canUseSingle && capacity >= partySize) {
  // Single-table match, add to singles list
  singleTableCandidates.push(table);
}

// ALWAYS add to validTables if it meets basic criteria (for combinations)
validTables.push(table);
```

### Option B: Ensure `enableCombinations` is TRUE

In the planner/auto-assign flow:

```typescript
const quote = await quoteTablesForBooking({
  bookingId,
  enableCombinations: true,  // ← EXPLICIT
  kMax: Math.max(4, Math.ceil(partySize / 2)),  // Dynamic based on party size
  ...
});
```

### Option C: Remove max_party_size from combination filtering

Currently, tables with `max_party_size=4` are being excluded from combinations for a party of 12. This is incorrect. Those tables should be allowed in combinations, just not as single-table assignments.

---

## 7. Immediate Action Items

1. **Verify the `enableCombinations` parameter value** during the failing auto-assignment
2. **Check the `maxTables` / `kMax` limit** being passed to the selector
3. **Review adjacency requirements** - are they too strict for this configuration?
4. **Check zone restrictions** - are all tables in different zones, preventing combinations?

---

## 8. Testing Script

To reproduce and test the fix:

```bash
# Run the planner with debug output
CAPACITY_DEBUG=1 pnpm tsx scripts/test-booking-assignment.ts 97fad88e-5c58-46a8-a2db-2882b9a567be
```

Or query directly:

```typescript
const result = await quoteTablesForBooking({
  bookingId: '97fad88e-5c58-46a8-a2db-2882b9a567be',
  holdTtlSeconds: 180,
  enableCombinations: true, // FORCE TRUE
  maxTables: 5, // Allow up to 5 tables
  requireAdjacency: false, // Relax for testing
});
```

---

## 9. Expected Outcome

With proper combination support, the system should be able to create plans like:

- **3× 4-top tables** = 12 capacity (perfect match)
- **2× 4-top + 2× 2-top** = 12 capacity
- **1× 4-top + 4× 2-top** = 12 capacity

All of these are viable combinations from the available inventory.
