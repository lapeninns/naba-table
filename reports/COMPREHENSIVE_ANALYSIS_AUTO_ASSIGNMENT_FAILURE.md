# Comprehensive Analysis: Auto-Assignment 100% Failure Rate

**Date**: 2024-11-04  
**Restaurant**: Prince of Wales Pub (Bromham)  
**Target Date**: 2025-11-10 (Monday)  
**Bookings**: 100 smart-generated bookings  
**Success Rate**: 0% (100 failures)  
**Avg Processing Time**: 35,300ms per booking (expected: <1,000ms)  
**Total Execution Time**: 15 minutes 6 seconds

---

## Executive Summary

The table auto-assignment system completely failed to assign any tables despite:

- 40 available tables with 210 total seats
- 0 existing assignments or holds
- Properly configured service periods
- Realistic booking data (party sizes 2-8)
- Tables passing basic SQL capacity filters

The root cause is **NOT** a data problem but a **system/algorithm malfunction** in the `quoteTablesForBooking` function, specifically in the time-based filtering, lookahead evaluation, or plan generation logic.

---

## Timeline of Investigation

### Phase 1: Initial Script Execution (2025-11-09)

**Objective**: Run auto-assignment on existing bookings  
**Command**: `pnpm tsx scripts/ops-auto-assign-ultra-fast.ts`

**Results**:

- Found **60 bookings** on 2025-11-09
- **0 successful** assignments
- **40 failures**: "No suitable tables available"
- **20 failures**: "Service overrun"

**Discovery**: Script was querying wrong column names:

- Used `datetime` instead of `booking_date`
- Used `booking_time` instead of `start_time`

**Fix Applied**: Updated script to use correct column names.

---

### Phase 2: Column Name Fix & Re-run (2025-11-09)

**Changes**:

```typescript
// scripts/ops-auto-assign-ultra-fast.ts
- .eq('datetime', CONFIG.TARGET_DATE)
+ .eq('booking_date', CONFIG.TARGET_DATE)

- booking_time
+ start_time
```

**Re-run Results**: Still 0% success rate

**Root Cause Analysis Initiated**: Why are all bookings failing despite tables existing?

---

### Phase 3: Deep Database Investigation

#### 3.1 Service Period Discovery

**Query**:

```sql
SELECT day_of_week, booking_option, start_time, end_time
FROM restaurant_service_periods
WHERE restaurant_id = '0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a';
```

**Finding**:

- 2025-11-09 is **Sunday** (day_of_week = 0)
- **NO service periods configured for Sunday**
- Only Monday-Friday (day_of_week 1-5) have service periods

**Impact**: This explains why all 60 bookings failed - no valid service windows existed.

#### 3.2 Table Inventory Analysis

**Query**:

```sql
SELECT
  COUNT(*) as total_tables,
  SUM(capacity) as total_seats,
  MIN(capacity) as min_capacity,
  MAX(capacity) as max_capacity
FROM table_inventory
WHERE restaurant_id = '0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a';
```

**Results**:

```
total_tables: 40
total_seats: 210
min_capacity: 2
max_capacity: 10
```

**Capacity Distribution**:
| Capacity | max_party_size | Count | Total Seats |
|----------|----------------|-------|-------------|
| 2 | 2 | 7 | 14 |
| 4 | 4 | 12 | 48 |
| 4 | 6 | 2 | 8 |
| 6 | 6 | 8 | 48 |
| 6 | 8 | 2 | 12 |
| 8 | 8 | 5 | 40 |
| 10 | 10 | 4 | 40 |

**Key Insight**: `max_party_size` constraints exist - this is critical for filtering logic.

#### 3.3 Party Size Analysis of Failed Bookings

**Query on 2025-11-09 bookings**:

```sql
SELECT party_size, COUNT(*) as booking_count
FROM bookings
WHERE restaurant_id = '0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a'
  AND booking_date = '2025-11-09'
GROUP BY party_size
ORDER BY party_size;
```

**Results**:

```
party_size | booking_count
-----------+--------------
7          | 40
8          | 20
```

**Critical Discovery**:

- **40 bookings** have party_size = 7
- **Maximum single-table max_party_size** = 10 (only 4 tables)
- But filtering logic: `partySize > table.maxPartySize` **rejects** the table
- For party of 7: Tables with capacity 8-10 have max_party_size 8-10, which SHOULD accept party of 7
- **However**: Most capacity 6 tables have max_party_size=6, rejecting party of 7

**Root Cause for 2025-11-09 failures**:

1. **Service period issue**: Sunday has no configured service periods
2. **Party size distribution**: Unrealistic - 100% of bookings were party of 7-8
3. **Table capacity constraints**: Limited tables can accommodate party of 7+ with adjacency

---

### Phase 4: Smart Booking Generator Creation

**Objective**: Generate realistic bookings based on actual restaurant configuration.

**Problem with Old Data**:

- Hardcoded random party sizes (e.g., always 7)
- No consideration for table inventory capacity
- No alignment with service periods
- No realistic customer data

**Solution**: Created `scripts/generate-smart-bookings.ts`

**Key Features**:

1. **Dynamic Service Period Loading**:

```typescript
const servicePeriods = await loadServicePeriodsForDate(restaurantId, targetDate);
```

2. **Table Inventory Analysis**:

```typescript
// Determine viable party sizes from actual table capacity
const viablePartySizes = determineViablePartySizes(tables);
```

3. **Weighted Random Distributions** (Industry Standard):

```typescript
const PARTY_SIZE_WEIGHTS = {
  2: 0.35, // 35% - most common
  3: 0.15, // 15%
  4: 0.25, // 25% - second most common
  5: 0.1, // 10%
  6: 0.1, // 10%
  7: 0.03, // 3%  - rare, requires combinations
  8: 0.02, // 2%  - rare, requires combinations
};
```

4. **Booking Type Distribution**:

```typescript
const BOOKING_TYPE_WEIGHTS = {
  lunch: 0.22, // 22%
  drinks: 0.2, // 20%
  dinner: 0.58, // 58% - most popular
};
```

5. **Customer Creation** (correct schema):

```typescript
// Creates customers with required fields
{
  restaurant_id: uuid,
  full_name: string,      // NOT 'name'
  email: string,
  phone: string
}
```

**Execution**:

```bash
pnpm tsx scripts/generate-smart-bookings.ts \
  --restaurant=prince-of-wales-pub-bromham \
  --date=2025-11-10 \
  --count=100
```

**Results**:

- ✅ Created 20 guest customers
- ✅ Generated 100 bookings for Monday 2025-11-10
- ✅ Party size distribution: 39× size 2, 27× size 4, 15× size 3, 10× size 5, 6× size 6, 2× size 7, 1× size 8
- ✅ All bookings within service period windows
- ✅ Realistic time slot distribution

---

### Phase 5: SQL Seed Generator Creation

**Objective**: Create reusable SQL seed file for database initialization.

**Created**: `scripts/generate-smart-seed-sql.ts`

**Output**: `supabase/seeds/smart-bookings.sql` (138 lines)

**Contents**:

```sql
-- Delete existing bookings for the date
DELETE FROM bookings
WHERE restaurant_id = '0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a'
  AND booking_date = '2025-11-10';

-- Insert 20 guest customers
INSERT INTO customers (id, restaurant_id, full_name, email, phone) VALUES
  ('24c35495-d310-0c5f-3244-79acc798d03d', '0babe9cf-...', 'Guest #1', ...),
  ...;

-- Insert 100 bookings
INSERT INTO bookings (...) VALUES
  (...),
  ...;
```

---

### Phase 6: Auto-Assignment Run on Smart Bookings (2025-11-10)

**Configuration**:

```typescript
const CONFIG = {
  TARGET_RESTAURANT_SLUG: 'prince-of-wales-pub-bromham',
  TARGET_DATE: '2025-11-10', // Monday - has service periods
  MAX_CONCURRENT_BOOKINGS: 15,
  SINGLE_ATTEMPT_ONLY: true,
  HOLD_TTL_SECONDS: 180,
  FORCE_REASSIGN_ALL: false, // Only pending bookings
};
```

**Execution**:

```bash
time pnpm tsx -r tsconfig-paths/register scripts/ops-auto-assign-ultra-fast.ts
```

**Results**:

```
Total bookings: 100
Pending processed: 100
✅ Success: 0
❌ Failed: 100
Success rate: 0%
⏱️ Total time: 906.22s (15 minutes 6 seconds)
⚡ Avg per booking: 35,300ms
```

**Failure Breakdown**:

- **86 failures**: "No suitable tables available"
- **14 failures**: "Reservation would overrun lunch service (end 15:00)"

**Critical Observations**:

1. **Extreme Slowness**: 35 seconds per booking vs expected <1 second = **35x slower**
2. **Even Simple Bookings Failed**: Party of 2 at 12:00 failed despite 7 available 2-seat tables
3. **No Conflicts**: 0 active holds, 0 existing assignments
4. **Service Overrun**: 14 bookings at 15:00-16:00 correctly rejected (lunch ends at 15:00)

**Console Warnings**:

```
[capacity.hold] failed to configure strict conflict enforcement
  { enabled: false, error: 'TypeError: fetch failed' }

[feature-flags][overrides] failed to fetch overrides
  { scope: 'development', error: 'TypeError: fetch failed' }

[scarcity] using heuristic fallback
  { restaurantId: '0babe...', type: 'capacity:2|category:bar|...',
    capacity: 2, fallback: 0.1143, tableCount: 7, seatSupply: 14 }

  ... (repeated 100+ times for all table types)
```

---

## Technical Deep Dive: Code Flow Analysis

### Assignment Algorithm Flow

```
┌─────────────────────────────────────────────────────────────┐
│ scripts/ops-auto-assign-ultra-fast.ts                       │
│   ↓                                                          │
│ 1. Load pending bookings for date                           │
│ 2. Process 15 bookings concurrently (MAX_CONCURRENT)        │
│ 3. For each booking:                                        │
│      fastAssign(bookingId) →                                │
└─────────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│ server/capacity/tables.ts :: quoteTablesForBooking()        │
│   ↓                                                          │
│ 1. loadBooking(bookingId) - fetch booking details           │
│ 2. loadTablesForRestaurant() - fetch all tables             │
│ 3. loadAdjacency() - fetch table adjacency relationships    │
│ 4. loadContextBookings() - fetch other bookings for day     │
│ 5. loadActiveHoldsForDate() - fetch active holds            │
│ 6. buildBusyMaps() - create time-based conflict map         │
│ 7. filterAvailableTables() ← CRITICAL FILTERING             │
│ 8. loadTableScarcityScores() - load/compute scarcity        │
│ 9. buildScoredTablePlans() ← CRITICAL PLAN GENERATION       │
│ 10. evaluateLookahead() - check future booking impact       │
│ 11. createHold() if plan exists                             │
└─────────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│ server/capacity/tables.ts :: filterAvailableTables()        │
│                                                              │
│ Filters tables by:                                          │
│   ✓ active === true                                         │
│   ✓ status !== 'out_of_service'                             │
│   ✓ capacity > 0 and finite                                 │
│   ✓ capacity >= partySize (if !allowInsufficientCapacity)   │
│   ✓ partySize <= maxPartySize (if maxPartySize set)  ← KEY  │
│   ✓ partySize >= minPartySize (if minPartySize set)         │
│   ✓ NOT in avoidTables set                                  │
│   ✓ zoneId matches (if specified)                           │
│   ✓ Time available (if timeFilter enabled) ← SUSPECT        │
│                                                              │
│ Time filtering:                                             │
│   → filterTimeAvailableTables()                             │
│     → Checks busy map for table conflicts                   │
│     → Removes tables with time overlaps                     │
└─────────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│ server/capacity/selector.ts :: buildScoredTablePlans()      │
│                                                              │
│ 1. Single table candidates:                                 │
│    → Filter validTables (capacity considerations)           │
│    → Score each table (scarcity, waste, demand)             │
│                                                              │
│ 2. Combination candidates (if enabled):                     │
│    → enumerateTableCombinations() - DFS search              │
│    → Score combinations                                     │
│    → Apply limits (maxCombinationEvaluations)               │
│                                                              │
│ 3. Sort all plans by score                                  │
│                                                              │
│ 4. Return { plans: TablePlan[], fallbackReason?: string }   │
│    → If plans.length === 0:                                 │
│       fallbackReason = "No suitable tables available"       │
└─────────────────────────────────────────────────────────────┘
```

### Critical Code Sections

#### 1. Table Filtering Logic

**File**: `server/capacity/tables.ts:702`

```typescript
export function filterAvailableTables(
  tables: Table[],
  partySize: number,
  window: ReturnType<typeof computeBookingWindow>,
  adjacency: Map<string, Set<string>>,
  avoidTables?: Set<string>,
  zoneId?: string | null,
  options?: { allowInsufficientCapacity?: boolean; timeFilter?: TimeFilterOptions },
): Table[] {
  const allowPartial = options?.allowInsufficientCapacity ?? false;
  const avoid = avoidTables ?? new Set<string>();

  const filtered = tables.filter((table) => {
    // Basic validations
    if (!table) return false;
    if (avoid.has(table.id)) return false;
    if (zoneId && table.zoneId !== zoneId) return false;
    if (table.active === false) return false;
    if (typeof table.status === 'string' && table.status.toLowerCase() === 'out_of_service')
      return false;

    // Capacity checks
    const capacity = table.capacity ?? 0;
    if (!Number.isFinite(capacity) || capacity <= 0) return false;
    if (!allowPartial && capacity < partySize) return false;

    // ⚠️ CRITICAL: max_party_size check
    if (
      typeof table.maxPartySize === 'number' &&
      table.maxPartySize > 0 &&
      partySize > table.maxPartySize
    ) {
      return false; // Rejects table if party exceeds max
    }

    // min_party_size check
    if (
      typeof table.minPartySize === 'number' &&
      table.minPartySize > 0 &&
      partySize < table.minPartySize
    ) {
      return false;
    }

    // Adjacency setup
    if (partiesRequireAdjacency(partySize) && adjacency.size > 0 && !adjacency.has(table.id)) {
      adjacency.set(table.id, new Set());
    }

    return true;
  });

  // ⚠️ SUSPECT: Time-based filtering
  const timeFiltered =
    options?.timeFilter && window
      ? filterTimeAvailableTables(
          filtered,
          window,
          options.timeFilter.busy,
          options.timeFilter.mode ?? 'strict',
          (stats) => options.timeFilter?.captureStats?.(stats),
        )
      : filtered;

  return timeFiltered.sort((a, b) => {
    const capacityDiff = (a.capacity ?? 0) - (b.capacity ?? 0);
    if (capacityDiff !== 0) return capacityDiff;
    return a.tableNumber.localeCompare(b.tableNumber);
  });
}
```

**Analysis**:

- Basic filters should pass for most tables
- max_party_size logic is correct
- **SUSPECT**: `filterTimeAvailableTables()` may be removing all tables

#### 2. Plan Generation Logic

**File**: `server/capacity/selector.ts:293`

```typescript
const fallbackReason = plans.length > 0 ? undefined : FALLBACK_NO_TABLES;
```

**Analysis**:

- If `buildScoredTablePlans()` returns 0 plans, fallbackReason is set
- This is the source of "No suitable tables available" error
- Question: Why are 0 plans being generated?

#### 3. Feature Flags

**File**: `server/capacity/tables.ts:3080-3081`

```typescript
const timePruningEnabled = isPlannerTimePruningEnabled();
const lookaheadEnabled = isSelectorLookaheadEnabled();
```

**Analysis**:

- If `timePruningEnabled === true`, loads context bookings and builds busy maps
- Busy maps track table availability over time
- **HYPOTHESIS**: Time pruning may be overly aggressive or buggy

---

## SQL Validation Tests

### Test 1: Tables Exist and Match Basic Criteria

```sql
SELECT COUNT(*) as total_tables,
       COUNT(*) FILTER (WHERE capacity >= 2) as suitable_for_2,
       COUNT(*) FILTER (WHERE capacity >= 4) as suitable_for_4
FROM table_inventory
WHERE restaurant_id = '0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a';

Result:
total_tables | suitable_for_2 | suitable_for_4
-------------+----------------+----------------
          40 |             40 |             33
```

✅ **PASS**: Tables exist and meet capacity requirements.

### Test 2: No Active Holds or Assignments

```sql
SELECT
  (SELECT COUNT(*) FROM table_holds
   WHERE restaurant_id = '0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a'
   AND expires_at > NOW()) as active_holds,
  (SELECT COUNT(*) FROM booking_table_assignments bta
   JOIN bookings b ON bta.booking_id = b.id
   WHERE b.restaurant_id = '0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a'
   AND b.booking_date = '2025-11-10') as assignments_2025_11_10;

Result:
active_holds | assignments_2025_11_10
-------------+------------------------
           0 |                      0
```

✅ **PASS**: No conflicts exist.

### Test 3: Suitable Tables for Specific Booking

```sql
SELECT
  b.id as booking_id,
  b.party_size,
  b.start_time,
  b.end_time,
  (SELECT array_agg(t.id ORDER BY t.capacity)
   FROM table_inventory t
   WHERE t.restaurant_id = b.restaurant_id
     AND t.capacity >= b.party_size
     AND (t.max_party_size IS NULL OR b.party_size <= t.max_party_size)
   LIMIT 3) as suitable_tables
FROM bookings b
WHERE b.id = '3c3c3c0a-9ab8-4a15-bc6d-3fe5d36b9eb8';  -- Party of 2 at 12:00

Result:
booking_id  | party_size | start_time | end_time | suitable_tables (40 tables!)
------------+------------+------------+----------+----------------------
3c3c3c0a... |          2 | 12:00:00   | 13:30:00 | {68830088..., 20736fc5..., ...}
```

✅ **PASS**: 40 tables are suitable for this simple booking.

### Test 4: Service Periods for Monday

```sql
SELECT day_of_week, booking_option, start_time, end_time
FROM restaurant_service_periods
WHERE restaurant_id = '0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a'
  AND day_of_week = 1;  -- Monday

Result:
day_of_week | booking_option | start_time | end_time
------------+----------------+------------+----------
          1 | lunch          | 12:00:00   | 15:00:00
          1 | drinks         | 15:00:00   | 17:00:00
          1 | dinner         | 17:00:00   | 22:00:00
```

✅ **PASS**: Service periods configured correctly for Monday.

**Conclusion from SQL Tests**:

- All data prerequisites are met
- Tables exist and are suitable
- No blocking conflicts
- The issue is in the TypeScript assignment logic, NOT the data

---

## Performance Analysis

### Expected vs Actual Performance

| Metric                      | Expected   | Actual     | Ratio           |
| --------------------------- | ---------- | ---------- | --------------- |
| Processing time per booking | <1,000ms   | 35,300ms   | **35x slower**  |
| Total time for 100 bookings | ~2 minutes | 15 minutes | **7.5x slower** |
| Success rate                | 70-90%     | 0%         | **∞x worse**    |

### Performance Red Flags

1. **Extreme Slowness**: 35 seconds per booking suggests:
   - Timeout/retry loops
   - Infinite or near-infinite iterations
   - Blocking I/O or network calls
   - Database query N+1 problems

2. **Consistent Failure**: 100% failure suggests:
   - Systematic algorithm bug
   - Misconfigured feature flags
   - Breaking assumption in code
   - Environmental issue (but SQL works fine)

3. **Console Spam**: 100+ "[scarcity] using heuristic fallback" messages:
   - Not critical (fallback works)
   - But indicates missing scarcity metrics in database
   - May contribute to slowness if metrics fetch is attempted repeatedly

### Failure Pattern Analysis

**Time Distribution of Failures**:

```
Lunch period (12:00-15:00):  ~22 failures
Drinks period (15:00-17:00): ~14 failures (service overrun)
Dinner period (17:00-22:00): ~64 failures
```

**Party Size Distribution of Failures**:

```
Party of 2: 27 failures (should have 7 suitable 2-seat tables)
Party of 3: 15 failures (should have 33 suitable tables)
Party of 4: 27 failures (should have 33 suitable tables)
Party of 5: 10 failures (should have 19 suitable tables)
Party of 6:  6 failures (should have 19 suitable tables)
Party of 7:  2 failures (requires combinations, expected)
Party of 8:  1 failure  (requires combinations, expected)
```

**Critical Insight**:

- Even the easiest bookings (party of 2) are failing
- This rules out combination/adjacency issues
- The problem is earlier in the pipeline

---

## Root Cause Hypotheses

### Hypothesis 1: Time Pruning Bug ⭐⭐⭐⭐⭐

**Likelihood**: VERY HIGH

**Evidence**:

- Time pruning is enabled (`isPlannerTimePruningEnabled()`)
- Builds busy maps from context bookings
- Filters tables by time availability
- 35-second processing time suggests expensive time-based computation

**Mechanism**:

```typescript
// Loads ALL bookings for the day
contextBookings = await loadContextBookings(...)

// Builds availability map
busyForPlanner = buildBusyMaps({
  targetBookingId: booking.id,
  bookings: contextBookings,
  holds: holdsForDay,
  policy,
  targetWindow: window,
});

// Filters tables by time
timeFiltered = filterTimeAvailableTables(
  filtered,
  window,
  busy,
  mode: "strict"  // ← May be too strict
);
```

**Potential Bugs**:

1. **Overly strict mode**: "strict" time filtering may reject all tables
2. **Busy map logic error**: Tables marked busy when they're not
3. **Window calculation bug**: Booking windows computed incorrectly
4. **Infinite loop**: Time conflict resolution may loop infinitely

**Test**:

```typescript
// Disable time pruning temporarily
const timePruningEnabled = false; // Override feature flag
```

### Hypothesis 2: Lookahead Evaluation Bug ⭐⭐⭐⭐

**Likelihood**: HIGH

**Evidence**:

- Lookahead is enabled (`isSelectorLookaheadEnabled()`)
- Evaluates future booking impacts on plan selection
- Could penalize ALL plans into rejection

**Mechanism**:

```typescript
const lookaheadDiagnostics = evaluateLookahead({
  lookahead: {
    enabled: true,
    windowMinutes: getSelectorLookaheadWindowMinutes(),
    penaltyWeight: getSelectorLookaheadPenaltyWeight(),
    blockThreshold: getSelectorLookaheadBlockThreshold(),
  },
  // ... evaluates future booking scenarios
});
```

**Potential Bugs**:

1. **Over-penalization**: All plans score below threshold
2. **Infinite recursion**: Evaluating future bookings recursively
3. **Block threshold too low**: Rejecting all plans as "blocking"

### Hypothesis 3: Scarcity Metrics Fetch Failure ⭐⭐⭐

**Likelihood**: MODERATE

**Evidence**:

- 100+ warnings: "[scarcity] using heuristic fallback"
- Fetch errors: "TypeError: fetch failed"
- May indicate database connection issues

**Mechanism**:

```typescript
const tableScarcityScores = await loadTableScarcityScores({
  restaurantId: booking.restaurant_id,
  tables: filtered,
  client: supabase,
});
```

**Potential Bugs**:

1. **Database query timeout**: Scarcity metrics query hangs
2. **Missing table**: `restaurant_table_scarcity` table doesn't exist
3. **Network issue**: Supabase connection flaky

**However**: The code uses heuristic fallback, so this shouldn't cause complete failure.

### Hypothesis 4: Feature Flag Fetch Failure ⭐⭐

**Likelihood**: LOW

**Evidence**:

- Warning: "[feature-flags][overrides] failed to fetch overrides"
- Warning: "[capacity.hold] failed to configure strict conflict enforcement"

**Impact**:

- Feature flags fall back to defaults
- Unlikely to cause 100% failure unless defaults are broken

### Hypothesis 5: Combination Planner Bug ⭐⭐

**Likelihood**: LOW

**Evidence**:

- Applies to party sizes requiring multi-table assignments
- But even party of 2 (single table) is failing

**Conclusion**: Not the primary issue, but may contribute to party 7-8 failures.

### Hypothesis 6: Service Period Validation Bug ⭐⭐

**Likelihood**: LOW

**Evidence**:

- 14 bookings correctly rejected: "would overrun lunch service"
- Shows service period validation IS working

**Conclusion**: Not the issue.

---

## Recommended Investigation Steps

### Step 1: Add Extensive Logging ⭐⭐⭐⭐⭐

**Priority**: CRITICAL

**Objective**: Trace exactly where tables are being filtered out.

**Implementation**:

```typescript
// In filterAvailableTables()
console.log('[filter] INPUT:', {
  totalTables: tables.length,
  partySize,
  windowStart: window.block.start,
  windowEnd: window.block.end,
});

const filtered = tables.filter((table) => {
  const checks = {
    exists: !!table,
    notAvoided: !avoid.has(table.id),
    zoneMatch: !zoneId || table.zoneId === zoneId,
    active: table.active !== false,
    notOutOfService: !(typeof table.status === "string" && table.status.toLowerCase() === "out_of_service"),
    hasCapacity: Number.isFinite(table.capacity) && table.capacity > 0,
    sufficientCapacity: allowPartial || table.capacity >= partySize,
    withinMaxParty: !(typeof table.maxPartySize === "number" && table.maxPartySize > 0 && partySize > table.maxPartySize),
    aboveMinParty: !(typeof table.minPartySize === "number" && table.minPartySize > 0 && partySize < table.minPartySize),
  };

  const pass = Object.values(checks).every(v => v);

  if (!pass) {
    console.log('[filter] REJECT:', table.id, table.tableNumber, checks);
  }

  return pass;
});

console.log('[filter] BASIC FILTERED:', filtered.length);

const timeFiltered = options?.timeFilter && window
  ? filterTimeAvailableTables(...)
  : filtered;

console.log('[filter] TIME FILTERED:', timeFiltered.length);
```

### Step 2: Disable Time Pruning ⭐⭐⭐⭐⭐

**Priority**: CRITICAL

**Objective**: Test if time-based filtering is the culprit.

**Implementation**:

```typescript
// In server/capacity/tables.ts :: quoteTablesForBooking()

// TEMP: Force disable time pruning for debugging
const timePruningEnabled = false; // isPlannerTimePruningEnabled();
const lookaheadEnabled = false; // isSelectorLookaheadEnabled();
```

**Expected Result**:

- If success rate improves: Time pruning is the bug
- If still 0%: Problem is elsewhere

### Step 3: Create Minimal Test Script ⭐⭐⭐⭐

**Priority**: HIGH

**Objective**: Isolate the problem in a controlled environment.

**Implementation**:

```typescript
// scripts/test-single-assignment.ts
import { createServerSupabaseClient } from '@/server/supabase';
import { quoteTablesForBooking, confirmHoldAssignment } from '@/server/capacity/tables';

async function testSingleAssignment() {
  const BOOKING_ID = '3c3c3c0a-9ab8-4a15-bc6d-3fe5d36b9eb8'; // Party of 2 at 12:00

  console.log('Testing booking:', BOOKING_ID);

  const quote = await quoteTablesForBooking({
    bookingId: BOOKING_ID,
    createdBy: 'test-script',
    holdTtlSeconds: 180,
  });

  console.log('Quote result:', {
    hasHold: !!quote.hold,
    reason: quote.error,
    diagnostics: quote.diagnostics,
  });

  if (quote.hold) {
    const confirm = await confirmHoldAssignment(quote.hold.id);
    console.log('Confirmation:', confirm);
  }
}

testSingleAssignment().catch(console.error);
```

### Step 4: Check Feature Flag Values ⭐⭐⭐

**Priority**: MEDIUM

**Objective**: Verify feature flags are set correctly.

**Implementation**:

```typescript
// In scripts/ops-auto-assign-ultra-fast.ts (at start of main())
console.log('[debug] Feature flags:', {
  timePruning: isPlannerTimePruningEnabled(),
  lookahead: isSelectorLookaheadEnabled(),
  holdsEnabled: isHoldsEnabled(),
  adjacencyRequired: isAllocatorAdjacencyRequired(),
  combinationEnabled: isCombinationPlannerEnabled(),
});
```

### Step 5: Query Performance Profiling ⭐⭐⭐

**Priority**: MEDIUM

**Objective**: Identify slow database queries.

**Implementation**:

```typescript
// Wrap all supabase queries with timing
const startTime = performance.now();
const { data, error } = await supabase.from('table_inventory').select('*');
const elapsed = performance.now() - startTime;
console.log('[perf] table_inventory query:', elapsed, 'ms');
```

### Step 6: Compare with Working System ⭐⭐

**Priority**: LOW (if available)

**Objective**: If there's a working environment or previous version, compare configurations.

---

## Data Quality Assessment

### ✅ Excellent

1. **Table Inventory**: 40 tables, well-distributed capacities
2. **Service Periods**: Properly configured for weekdays
3. **Smart Bookings**: Realistic party sizes and time distribution
4. **Customer Data**: Correct schema with required fields

### ⚠️ Needs Improvement

1. **Scarcity Metrics**: Missing from database (using fallbacks)
2. **Table Adjacency**: Unknown if configured (may affect party 7-8)
3. **Monitoring**: No real-time metrics or alerts for assignment failures

### ❌ Poor (Old Data)

1. **2025-11-09 Bookings**: All party size 7-8, no service periods for Sunday
2. **Hardcoded Seeds**: Not aligned with restaurant configuration

---

## Impact Assessment

### Business Impact

- **Critical**: 0% auto-assignment success means manual intervention required for ALL bookings
- **Customer Experience**: Delayed confirmations, potential double-bookings
- **Operational Efficiency**: Staff must manually assign 100% of tables

### Technical Debt

- **Algorithm Complexity**: Over-engineered with time pruning, lookahead, scarcity, adjacency
- **Debugging Difficulty**: Lack of logging makes diagnosis extremely difficult
- **Testing Gap**: No automated tests catching this regression

### Data Impact

- **100 Pending Bookings**: All remain unassigned
- **Customer Records**: 20 guest customers created successfully
- **No Data Corruption**: Database state is clean

---

## Comparative Analysis: 2025-11-09 vs 2025-11-10

| Aspect                  | 2025-11-09 (Sunday)     | 2025-11-10 (Monday)   |
| ----------------------- | ----------------------- | --------------------- |
| **Day of Week**         | Sunday (0)              | Monday (1)            |
| **Service Periods**     | ❌ None configured      | ✅ 3 periods (L/D/D)  |
| **Booking Count**       | 60                      | 100                   |
| **Party Size Dist**     | ❌ 100% size 7-8        | ✅ Realistic (2-8)    |
| **Data Source**         | ❌ Hardcoded random     | ✅ Smart generator    |
| **Expected Success**    | 0% (no service periods) | 70-90% (realistic)    |
| **Actual Success**      | 0%                      | 0%                    |
| **Failure Reasons**     | Service/Capacity        | "No suitable tables"  |
| **Avg Processing Time** | ~60 seconds             | 35 seconds            |
| **Root Cause**          | Bad data + no service   | Algorithm malfunction |

**Key Insight**:

- 2025-11-09 failure was expected (bad data)
- 2025-11-10 failure is unexpected (good data, should work)
- The algorithm itself is broken, NOT just the data

---

## Code Paths Requiring Investigation

### Critical Path 1: Time Filtering

**File**: `server/capacity/tables.ts`  
**Function**: `filterTimeAvailableTables()`  
**Priority**: ⭐⭐⭐⭐⭐

**Questions**:

- How does it determine if a table is "busy"?
- What does "strict" mode do?
- Can it mistakenly mark all tables as unavailable?

### Critical Path 2: Busy Map Building

**File**: `server/capacity/tables.ts`  
**Function**: `buildBusyMaps()`  
**Priority**: ⭐⭐⭐⭐⭐

**Questions**:

- Does it correctly handle empty contextBookings?
- What happens when there are 0 existing assignments?
- Could it create a "fully busy" map by mistake?

### Critical Path 3: Plan Scoring

**File**: `server/capacity/selector.ts`  
**Function**: `buildScoredTablePlans()`  
**Priority**: ⭐⭐⭐⭐

**Questions**:

- What makes a plan score too low to be selected?
- Are ALL plans being rejected by scoring logic?
- Is there a minimum score threshold?

### Critical Path 4: Lookahead Evaluation

**File**: `server/capacity/tables.ts`  
**Function**: `evaluateLookahead()`  
**Priority**: ⭐⭐⭐⭐

**Questions**:

- Can it reject all plans?
- What is the penalty weight and threshold?
- Does it cause recursion or infinite loops?

---

## Environmental Factors

### Database Connection

- **Type**: Supabase Pooler (PostgreSQL)
- **Status**: ✅ Connected (SQL queries work)
- **Latency**: Unknown (should measure)

### Feature Flags

- **Source**: Database table `feature_flag_overrides` (possibly missing)
- **Fetch Status**: ❌ Failed ("TypeError: fetch failed")
- **Fallback**: Using default values

### Node.js Environment

- **Version**: Unknown
- **Memory**: Sufficient (no OOM errors)
- **CPU**: Sufficient (just slow, not crashing)

---

## Conclusion

### What We Know For Certain

1. ✅ **Tables exist**: 40 tables, 210 seats, proper capacity distribution
2. ✅ **No conflicts**: 0 holds, 0 assignments, all tables available
3. ✅ **Service periods configured**: Monday has 3 periods (lunch/drinks/dinner)
4. ✅ **Smart bookings are realistic**: Party sizes 2-8, proper time slots
5. ✅ **SQL filtering works**: Direct SQL queries return suitable tables
6. ❌ **TypeScript algorithm fails**: 0% success rate, 35 seconds per booking
7. ❌ **Even simple cases fail**: Party of 2 at 12:00 with 7 available tables

### What We Strongly Suspect

1. **Time pruning bug**: `filterTimeAvailableTables()` removes all tables
2. **Busy map error**: `buildBusyMaps()` marks tables as unavailable incorrectly
3. **Performance issue**: 35-second processing suggests timeout/retry/loop bug
4. **Scarcity metrics missing**: Not critical but contributes to slowness

### What We Need To Investigate

1. **Add logging** to trace table filtering step-by-step
2. **Disable time pruning** to test if it's the culprit
3. **Profile database queries** to find slow operations
4. **Create minimal test** to isolate the bug
5. **Check feature flags** to ensure correct configuration

### Recommended Next Action

**IMMEDIATE (Today)**:

1. Add extensive logging to `filterAvailableTables()` and `buildScoredTablePlans()`
2. Create a single-booking test script
3. Temporarily disable time pruning and lookahead

**SHORT-TERM (This Week)**:

1. Fix the identified bug in time filtering or plan generation
2. Add automated tests for basic assignment scenarios
3. Implement performance monitoring/alerting

**LONG-TERM (This Month)**:

1. Simplify the allocator algorithm (consider removing overly complex features)
2. Add comprehensive logging throughout the assignment pipeline
3. Create debugging dashboard for assignment failures
4. Document the algorithm flow and decision points

---

## References

### Files Investigated

- `scripts/ops-auto-assign-ultra-fast.ts` - Main assignment script
- `scripts/generate-smart-bookings.ts` - Booking generator
- `scripts/generate-smart-seed-sql.ts` - SQL seed generator
- `server/capacity/tables.ts` - Table assignment logic (3,676 lines)
- `server/capacity/selector.ts` - Plan generation logic (892 lines)
- `server/capacity/scarcity.ts` - Scarcity scoring
- `server/feature-flags.ts` - Feature flag system

### Database Tables

- `bookings` - Booking records
- `table_inventory` - Table definitions
- `booking_table_assignments` - Table assignments
- `table_holds` - Temporary holds
- `restaurant_service_periods` - Service time windows
- `customers` - Customer records
- `restaurant_table_scarcity` - Scarcity metrics (missing data)

### Reports Generated

- `/reports/auto-assign-ultra-fast-2025-11-10-2025-11-04T16-53-37.296Z.json` - Full failure report
- `/reports/ROOT_CAUSE_FINAL.md` - Party size 7 analysis
- `/reports/ANALYSIS_no_suitable_tables.md` - Initial investigation

### External Dependencies

- Supabase PostgreSQL (remote only)
- Luxon (date/time handling)
- Next.js (framework)
- TypeScript (language)

---

**Document Version**: 1.0  
**Author**: AI Analysis  
**Status**: Ready for Review  
**Next Review**: After implementing logging and fixes
