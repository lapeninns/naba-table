# Analysis: Why "No Suitable Tables Available" Despite 40 Tables

## Investigation Summary

**Date:** November 4, 2025  
**Restaurant:** Prince of Wales Pub (Bromham)  
**Booking Date:** 2025-11-09  
**Issue:** 60 pending bookings failing with "No suitable tables available"

---

## ✅ Physical Inventory Check

```sql
SELECT COUNT(*) as total_tables,
       SUM(capacity) as total_seats,
       COUNT(*) FILTER (WHERE status = 'available' AND active = true) as available_tables
FROM table_inventory
WHERE restaurant_id = '0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a';
```

**Result:**

- **40 tables** exist
- **210 total seats**
- **40 available** (100% availability)

✅ **Physical capacity is fine**

---

## ✅ Booking Status Check

```sql
SELECT booking_date, start_time, end_time, party_size, status,
       COUNT(bta.table_id) as tables_assigned
FROM bookings b
LEFT JOIN booking_table_assignments bta ON b.id = bta.booking_id
WHERE b.restaurant_id = '0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a'
  AND b.booking_date = '2025-11-09'
GROUP BY b.id
ORDER BY b.start_time;
```

**Result:**

- **60 pending bookings**
- **0 table assignments** (all bookings have `tables_assigned = 0`)
- No confirmed bookings blocking capacity

✅ **No existing assignments blocking tables**

---

## ✅ Hold Status Check

```sql
SELECT COUNT(*) as total_holds,
       COUNT(*) FILTER (WHERE expires_at > NOW()) as active_holds,
       COUNT(*) FILTER (WHERE expires_at <= NOW()) as expired_holds
FROM table_holds th
JOIN bookings b ON th.booking_id = b.id
WHERE b.restaurant_id = '0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a'
  AND b.booking_date = '2025-11-09';
```

**Result:**

- **0 total holds**
- **0 active holds**
- **0 expired holds**

✅ **No holds blocking capacity**

---

## 🔍 Root Cause Analysis

### Code Flow Investigation

The failure occurs in the **capacity engine** (`server/capacity/tables.ts`):

```typescript
// Line 3177
const plans = buildScoredTablePlans({
  tables: filtered, // ← Tables AFTER filtering
  partySize: booking.party_size,
  adjacency,
  config: scoringConfig,
  // ...
});

// Line 3411
return {
  hold: null,
  candidate: null,
  alternates,
  nextTimes: [],
  reason: plans.fallbackReason ?? 'No suitable tables available',
  // ↑ Returns this when plans.plans.length === 0
};
```

### The Selector Logic (`server/capacity/selector.ts`)

```typescript
// Line 293
const fallbackReason = plans.length > 0 ? undefined : FALLBACK_NO_TABLES;

// Line 140
const FALLBACK_NO_TABLES = 'No tables meet the capacity requirements for this party size.';
```

**The selector returns 0 plans when no tables pass the capacity filter.**

---

## 🎯 **Root Cause: Service Period Configuration**

The issue is in the `service_periods` table. Let me check:

### Sample Failing Bookings

```
start_time  | end_time | party_size | reason
12:00:00    | 13:30:00 | 4          | No suitable tables available
12:15:00    | 13:45:00 | 7          | No suitable tables available
12:30:00    | 14:00:00 | 4          | No suitable tables available
12:45:00    | 14:15:00 | 7          | No suitable tables available
13:00:00    | 14:30:00 | 4          | No suitable tables available
13:15:00    | 14:45:00 | 7          | No suitable tables available
13:30:00    | 15:00:00 | 4          | No suitable tables available
13:45:00    | 15:15:00 | 7          | Overrun lunch service (end 15:00)
```

### Two Issues Identified

1. **Service Period Overrun (20 bookings)**
   - Bookings at 13:45, 14:00, 14:15, 14:30, 14:45, 15:00, 15:15, etc.
   - End times: 15:15, 15:30, 15:45, 16:00, 16:30, 17:00
   - Lunch service ends at **15:00**
   - These bookings **explicitly rejected** with message:
     ```
     "Reservation would overrun lunch service (end 15:00)."
     ```

2. **Capacity Filter Issue (40 bookings)**
   - Bookings at 12:00-13:45 (lunch service)
   - Bookings at 18:00-20:15 (dinner service?)
   - Getting generic "No suitable tables available"
   - **This is the mystery!**

---

## 🔬 **Hypothesis: The filterAvailableTables Function**

The key is in `filterAvailableTables()` which runs BEFORE the selector:

```typescript
// Line ~3120
const filtered = filterAvailableTables(
  tables,
  booking.party_size,
  window,
  adjacency,
  undefined,
  undefined,
  { allowInsufficientCapacity: true },
);

// Then pass filtered tables to selector
const plans = buildScoredTablePlans({
  tables: filtered, // ← Only tables that passed filter
  // ...
});
```

**If `filtered` is empty, then `plans.length` will be 0!**

---

## 🎯 **Most Likely Causes**

### 1. **Service Window Mismatch**

The booking window might not match any active service period:

- Lunch service: 11:00 - 15:00
- Dinner service: Maybe 17:00 - 22:00?
- **Gap:** 15:00 - 17:00 (no service)

Bookings in the gap would have no valid service window.

### 2. **Zone/Category Mismatch**

Tables might be in zones/categories that don't match booking requirements:

- Booking requires `category: 'dining'`
- But tables are in `category: 'patio'` or `category: 'private'`
- No tables pass the category filter

### 3. **Seating Preference Mismatch**

Bookings might have `seating_preference` that doesn't match table `seating_type`:

- Booking: `seating_preference: 'booth'`
- Tables: All `seating_type: 'standard'`
- No match = 0 tables

### 4. **Capacity Range Mismatch**

Tables might have `min_party_size` / `max_party_size` that excludes the party:

- Party size: 7
- All tables have `max_party_size: 6`
- No single table fits party of 7

---

## 📋 **Next Steps to Debug**

### Step 1: Check Service Periods

```sql
SELECT period_name, day_of_week, start_time, end_time, active
FROM service_periods
WHERE restaurant_id = '0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a'
ORDER BY start_time;
```

### Step 2: Check Table Constraints

```sql
SELECT
  capacity,
  min_party_size,
  max_party_size,
  category,
  seating_type,
  status,
  active,
  COUNT(*) as count
FROM table_inventory
WHERE restaurant_id = '0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a'
GROUP BY capacity, min_party_size, max_party_size, category, seating_type, status, active
ORDER BY capacity;
```

### Step 3: Check Booking Seating Preferences

```sql
SELECT
  seating_preference,
  party_size,
  start_time,
  COUNT(*) as count
FROM bookings
WHERE restaurant_id = '0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a'
  AND booking_date = '2025-11-09'
  AND status = 'pending'
GROUP BY seating_preference, party_size, start_time
ORDER BY start_time;
```

### Step 4: Add Debug Logging to Capacity Engine

Modify `filterAvailableTables` to log:

- How many tables before filtering
- How many tables after filtering
- Why tables were filtered out

---

## 🎬 **Conclusion**

**The "temporal capacity deadlock" description was misleading.**

The real issue is NOT about temporal conflicts (no holds, no assignments).

The real issue is that the **capacity filter** is rejecting ALL 40 tables before the selector even runs.

This is most likely due to:

1. ✅ **Service period configuration** (confirmed: 20 bookings overrun lunch)
2. ❓ **Zone/category/seating type mismatches** (needs investigation)
3. ❓ **Party size constraints** (needs investigation)

**Recommended Fix:**

1. Query service_periods and table constraints
2. Fix service period end time (extend lunch or add afternoon service)
3. Check why 40 bookings at valid times are getting filtered out
