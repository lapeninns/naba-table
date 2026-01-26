# Business Logic Reference

**Last Updated**: 2025-11-29
**Purpose**: Comprehensive catalog of all business rules and logic in the SajiloReserveX system

---

## Table of Contents

1. [Table Rules](#table-rules)
2. [Booking Rules](#booking-rules)
3. [Service Period Rules](#service-period-rules)
4. [Capacity Planning Rules](#capacity-planning-rules)
5. [Table Assignment Rules](#table-assignment-rules)
6. [Timing & Duration Rules](#timing--duration-rules)
7. [Validation Rules](#validation-rules)
8. [Feature Flags](#feature-flags)
9. [Scoring & Optimization](#scoring--optimization)
10. [Status Transitions](#status-transitions)

---

## Table Rules

**Source**: `server/capacity/table-rules.ts`

### Table Mobility Rules

Tables are classified by physical mobility, which determines merging behavior:

#### **Movable Tables**

- **Can be merged**: Yes
- **Min party size**: 1
- **Max party size**: `null` (unlimited when combined)
- **Requires adjacency**: Yes (for merging)
- **Use case**: Can be combined with other movable tables to accommodate larger parties

```typescript
// Example: 4-capacity movable table
deriveTableRules({ capacity: 4, mobility: "movable" })
→ {
    minPartySize: 1,
    maxPartySize: null,  // Can be combined
    canBeMerged: true,
    requiresAdjacency: true
  }
```

#### **Fixed Tables**

- **Can be merged**: No
- **Min party size**: 1
- **Max party size**: Equal to table capacity (strict limit)
- **Requires adjacency**: No (not applicable)
- **Use case**: Permanent fixtures that cannot be moved or combined

```typescript
// Example: 6-capacity fixed table
deriveTableRules({ capacity: 6, mobility: "fixed" })
→ {
    minPartySize: 1,
    maxPartySize: 6,  // Strict limit
    canBeMerged: false,
    requiresAdjacency: false
  }
```

### Table Combination Rules

**Conditions for combining tables**:

1. All tables must be **movable**
2. All tables must be **adjacent** (physically next to each other)
3. Maximum **3 tables** can be combined (`kMax = 3`)
4. Combined capacity must meet or exceed party size
5. All tables must be in the same **zone** (if zone enforcement is active)

**Example**:

- Party size: 11 people
- Tables: MD1-I-401 (4) + MD1-I-402 (4) + MD1-I-403 (4) = 12 capacity ✅
- All movable ✅
- All adjacent ✅
- Same zone ✅

---

## Booking Rules

**Sources**: `server/bookings.ts`, `server/feature-flags.ts`

### Booking Statuses

Valid booking statuses:

- `pending` - Awaiting confirmation or table assignment
- `confirmed` - Booking confirmed with table assignment
- `cancelled` - Booking cancelled by customer or restaurant
- `seated` - Guest has arrived and been seated
- `completed` - Dining experience completed
- `no_show` - Guest did not arrive

### Status Transition Rules

```
pending → confirmed → seated → completed
   ↓          ↓         ↓
cancelled  cancelled  cancelled
   ↓          ↓         ↓
           no_show   no_show
```

### Pending Booking Grace Period

**Rule**: Self-serve bookings have a grace period before expiration

- **Default**: 10 minutes
- **Configurable**: `NEXT_PUBLIC_BOOKING_PENDING_GRACE_MINUTES` (1-60 minutes)
- **Purpose**: Allow customers time to complete payment/confirmation

**Source**: `lib/env.ts:184-187`

### Past Time Booking Blocking

**Rule**: Prevent bookings in the past

- **Enabled**: `FEATURE_BOOKING_PAST_TIME_BLOCKING`
- **Grace period**: 5 minutes (configurable)
- **Purpose**: Prevent accidental bookings for times that have passed

**Source**: `lib/env.ts:182-183`

---

## Service Period Rules

**Source**: `server/capacity/policy.ts`

### Default Service Definitions

#### **Lunch Service**

```typescript
{
  key: "lunch",
  label: "Lunch",
  start: { hour: 12, minute: 0 },  // 12:00 PM
  end: { hour: 15, minute: 0 },    // 3:00 PM
  buffer: { pre: 0, post: 5 },     // 5 min post-service buffer
  allowOverrun: true,              // Can extend past end time
  turnBands: [
    { maxPartySize: 2, durationMinutes: 60 },   // 2-person: 60 min
    { maxPartySize: 4, durationMinutes: 75 },   // 3-4 person: 75 min
    { maxPartySize: 6, durationMinutes: 85 },   // 5-6 person: 85 min
    { maxPartySize: 8, durationMinutes: 85 },   // 7-8 person: 85 min
  ]
}
```

#### **Dinner Service**

```typescript
{
  key: "dinner",
  label: "Dinner",
  start: { hour: 17, minute: 0 },  // 5:00 PM
  end: { hour: 22, minute: 0 },    // 10:00 PM
  buffer: { pre: 0, post: 5 },     // 5 min post-service buffer
  turnBands: [
    { maxPartySize: 2, durationMinutes: 60 },   // 2-person: 60 min
    { maxPartySize: 4, durationMinutes: 75 },   // 3-4 person: 75 min
    { maxPartySize: 6, durationMinutes: 85 },   // 5-6 person: 85 min
    { maxPartySize: 8, durationMinutes: 90 },   // 7-8 person: 90 min
  ]
}
```

### Turn Duration Rules

**Logic**: Booking duration is determined by party size using turn bands

**Algorithm**:

1. Find the smallest `maxPartySize` ≥ actual party size
2. Use that band's `durationMinutes`
3. If party size exceeds all bands, use the largest band's duration

**Example**:

- Party size: 5 → Uses band with `maxPartySize: 6` → 85 minutes
- Party size: 10 → Uses band with `maxPartySize: 8` → 90 minutes (largest)

### Buffer Rules

**Purpose**: Prevent back-to-back bookings, allow for cleanup/turnover

- **Pre-buffer**: Time before booking starts (usually 0)
- **Post-buffer**: Time after booking ends (usually 5 minutes)
- **Total block time**: `turn duration + post-buffer`

**Example**:

- Booking: 6:00 PM - 7:30 PM (90 min)
- Post-buffer: 5 min
- Table blocked until: 7:35 PM

---

## Capacity Planning Rules

**Source**: `server/capacity/selector.ts`, `server/capacity/policy.ts`

### Overage Rules

**Definition**: Extra capacity beyond party size

**Max overage allowed**: 4 seats

- **Example**: 6-person party can use 10-seat capacity (6 + 4 overage) ✅
- **Example**: 6-person party cannot use 11-seat capacity (6 + 5 overage) ❌

**Purpose**:

- Balance efficiency vs. comfort
- Prevent wasting large tables on small parties
- Maintain revenue optimization

**Source**: `server/capacity/policy.ts:125`

### Table Count Limits

**Max tables per booking**: 3 tables

- **Configurable**: `FEATURE_ALLOCATOR_K_MAX` (1-5)
- **Default**: 3
- **Purpose**: Simplify service, maintain cohesive dining experience

**Source**: `lib/env.ts:144`

### Adjacency Requirements

**Rule**: Combined tables must be physically adjacent (connected graph)

**Adjacency mode**: fixed to `connected`

**Requirement**: always enforced for merged tables (not configurable)

**Source**: `server/feature-flags.ts`

---

## Table Assignment Rules

**Source**: `server/capacity/table-assignment/availability.ts`

### Table Filtering Criteria

Tables are filtered based on:

1. **Zone matching**: If `zoneId` specified, table must be in that zone
2. **Zone active**: Parent zone must be active
3. **Table active**: Table itself must be active
4. **Table status**: Must be `"available"`
5. **Avoid list**: Table not in avoid list
6. **Capacity**: Sufficient capacity for party (or can be merged)
7. **Mobility**: If party > table capacity, table must be movable
8. **Party size limits**: Respect min/max party size rules (derived from mobility)
9. **Adjacency**: If required, table must have adjacency data

### Hold System Rules

**Purpose**: Temporarily reserve tables during booking flow

**Hold properties**:

- **Enabled**: `FEATURE_HOLDS_ENABLED` (default: true)
- **TTL (Time To Live)**: Default 180 seconds (3 minutes)
- **Minimum TTL**: 60 seconds
- **Strict conflicts**: `FEATURE_HOLDS_STRICT_CONFLICTS` (default: true)
- **Rate limiting**:
  - Window: 60 seconds
  - Max per booking: 5 holds

**Hold expiration**: Holds automatically expire after TTL; tables become available again

**Source**: `lib/env.ts:244-251`

---

## Timing & Duration Rules

### Auto-Assign Timing

**Start cutoff**: Don't auto-assign if booking starts in < N minutes

- **Default**: 10 minutes
- **Configurable**: `AUTO_ASSIGN_START_CUTOFF_MINUTES`
- **Purpose**: Avoid assigning tables for imminent bookings that might have special handling

**Inline timeout**: Timeout for immediate auto-assign during booking creation

- **Default**: 12,000 ms (12 seconds)
- **Configurable**: `INLINE_AUTO_ASSIGN_TIMEOUT_MS`
- **Purpose**: Don't delay booking confirmation too long

**Source**: `lib/env.ts`

### Auto-Assign Retry Policy

**Max retries**: 0 (no retries by default)

- **Configurable**: `AUTO_ASSIGN_MAX_RETRIES`
- **Retry delays**: Configurable comma-separated delays in ms
- **Purpose**: V1 policy - fail fast, don't retry

**V2 Policy** (when enabled):

- Smarter retry logic based on failure reason
- Hard failures (no capacity) stop retries
- Soft failures (timeout) allow retries

**Source**: `lib/env.ts:253-261`

---

## Validation Rules

### Booking Validation

**Required fields**:

- `restaurant_id`
- `customer_name`
- `customer_email`
- `party_size` (must be > 0)
- `booking_date`
- `start_time`

**Email validation**:

- Must be valid email format
- Checked before creating booking

**Phone validation** (if provided):

- Accepts various formats
- Not strictly required

### Manual Table Selection Validation

**Checks performed** (`server/capacity/table-assignment/manual.ts`):

1. **Capacity check**: Total capacity ≥ party size
2. **Slack check**: Overage ≤ max allowed (4 by default)
3. **Zone check**: All tables in same zone
4. **Movable check**: If multiple tables, all must be movable
5. **Adjacency check**: If required, tables must be adjacent
6. **Conflict check**: No overlapping bookings or holds
7. **Active check**: All tables must be active and available

Each check returns:

- `status`: "ok" | "warning" | "error"
- `message`: Human-readable explanation
- `details`: Additional context

---

## Feature Flags

**Source**: `lib/env.ts`, `server/feature-flags.ts`

### Core Capacity Features

| Flag                                   | Default       | Description                                 |
| -------------------------------------- | ------------- | ------------------------------------------- |
| `FEATURE_COMBINATION_PLANNER`          | `true`        | Enable table combinations for large parties |
| `FEATURE_ALLOCATOR_MERGES_ENABLED`     | `!production` | Enable table merging in allocator           |
| `FEATURE_ALLOCATOR_K_MAX`              | `3`           | Max tables per booking (1-5)                |
| `FEATURE_SELECTOR_SCORING`             | `true`        | Enable scoring-based table selection        |
| `FEATURE_SELECTOR_LOOKAHEAD`           | `true`        | Consider future bookings when assigning     |
| `FEATURE_PLANNER_TIME_PRUNING_ENABLED` | `true`        | Pre-filter tables by time availability      |

### Assignment Features

| Flag                                            | Default | Description                            |
| ----------------------------------------------- | ------- | -------------------------------------- |
| `FEATURE_ALLOCATOR_ADJACENCY`                   | `true`  | Require adjacent tables for merges     |
| `FEATURE_ADJACENCY_VALIDATION`                  | `false` | Validate adjacency in manual selection |
| `FEATURE_ADJACENCY_QUERY_UNDIRECTED`            | `true`  | Treat adjacency as bidirectional       |
| `FEATURE_MANUAL_ASSIGNMENT_SESSION`             | `false` | Enable session-based manual assignment |
| `FEATURE_MANUAL_ASSIGNMENT_SNAPSHOT_VALIDATION` | `true`  | Validate assignment against snapshot   |

### Booking Lifecycle

| Flag                                 | Default | Description                            |
| ------------------------------------ | ------- | -------------------------------------- |
| `FEATURE_BOOKING_PAST_TIME_BLOCKING` | `false` | Block bookings in the past             |
| `FEATURE_OPS_BOOKING_LIFECYCLE_V2`   | `false` | Use V2 lifecycle management            |
| `FEATURE_AUTO_ASSIGN_ON_BOOKING`     | `true`  | Auto-assign tables on booking creation |
| `AUTO_ASSIGN_RETRY_POLICY_V2`        | `false` | Use V2 retry policy                    |

### Optimization Features

| Flag                             | Default | Description                    |
| -------------------------------- | ------- | ------------------------------ |
| `PLANNER_CACHE_ENABLED`          | `false` | Cache planner results          |
| `PLANNER_CACHE_TTL_MS`           | `60000` | Cache TTL (1-600 seconds)      |
| `FEATURE_HOLDS_ENABLED`          | `true`  | Enable table hold system       |
| `FEATURE_HOLDS_STRICT_CONFLICTS` | `true`  | Strict hold conflict detection |

### Observability

| Flag                              | Default | Description                     |
| --------------------------------- | ------- | ------------------------------- |
| `FEATURE_OPS_METRICS`             | `false` | Collect operational metrics     |
| `FEATURE_OPS_REJECTION_ANALYTICS` | `false` | Track rejection reasons         |
| `DEBUG_CAPACITY_PROFILING`        | `false` | Enable capacity debug profiling |

---

## Scoring & Optimization

**Source**: `server/capacity/policy.ts:116-127`

### Table Selection Scoring Weights

When multiple table combinations are possible, the system scores them and selects the best:

```typescript
{
  overage: 5,          // Penalty for extra capacity (higher = worse)
  tableCount: 3,       // Penalty for using more tables
  fragmentation: 2,    // Penalty for non-contiguous tables
  zoneBalance: 4,      // Favor balanced zone usage
  adjacencyCost: 1,    // Slight penalty for complex adjacency
  scarcity: 100        // Prefer preserving scarce tables (dynamic)
}
```

**Scoring algorithm**:

1. Lower score = better option
2. Multiply each factor by its weight
3. Sum all weighted penalties
4. Select combination with lowest total score

**Scarcity weight** (dynamic):

- Calculated based on current demand and availability
- Higher during peak times
- Helps preserve large tables for large parties

---

## Status Transitions

### Booking Status Lifecycle

```
┌─────────┐
│ pending │ ──────────────┐
└─────────┘               │
     │                    │
     ▼                    ▼
┌───────────┐        ┌───────────┐
│ confirmed │ ────▶  │ cancelled │
└───────────┘        └───────────┘
     │
     ▼
┌─────────┐
│ seated  │ ─────────┐
└─────────┘          │
     │               ▼
     │          ┌──────────┐
     ├────────▶ │ no_show  │
     │          └──────────┘
     ▼
┌───────────┐
│ completed │
└───────────┘
```

### Valid Transitions

| From        | To          | Trigger                                            |
| ----------- | ----------- | -------------------------------------------------- |
| `pending`   | `confirmed` | Table assignment successful OR manual confirmation |
| `pending`   | `cancelled` | Customer cancellation OR expiration                |
| `confirmed` | `seated`    | Guest arrival confirmation                         |
| `confirmed` | `cancelled` | Late cancellation                                  |
| `confirmed` | `no_show`   | Guest didn't arrive                                |
| `seated`    | `completed` | End of dining experience                           |
| `seated`    | `cancelled` | Emergency cancellation                             |
| `seated`    | `no_show`   | Error correction (rare)                            |

### Immutable Statuses

Once a booking reaches these statuses, it cannot be modified:

- `cancelled`
- `completed`
- `no_show`

**Reason**: Historical record integrity, analytics accuracy

---

## Default Configuration Values

### Timezone

**Default**: `Europe/London`
**Configurable**: Per restaurant in `restaurants` table
**Source**: `server/capacity/policy.ts:8`

### Service Order

**Default**: `["lunch", "dinner"]`
**Purpose**: Order to check when determining which service a booking belongs to

### Max Combination Evaluations

**Default**: 1,000 combinations
**Configurable**: `FEATURE_SELECTOR_MAX_COMBINATION_EVALUATIONS` (1-5000)
**Purpose**: Limit computational cost of finding optimal table combination

### Enumeration Timeout

**Default**: `null` (no timeout)
**Configurable**: `FEATURE_SELECTOR_ENUMERATION_TIMEOUT_MS` (50-10,000 ms)
**Purpose**: Prevent hanging on complex table selection scenarios

---

## Business Rules by Priority

### Critical (Cannot be violated)

1. ✅ **Capacity must meet party size** (after merging)
2. ✅ **Tables must be available** (no conflicts)
3. ✅ **Movable tables required** for combinations
4. ✅ **Adjacency required** for combined tables
5. ✅ **Zone lock enforcement** if `assigned_zone_id` set

### Important (Should be respected)

6. ⚠️ **Overage limit** (≤ 4 seats)
7. ⚠️ **Table count limit** (≤ 3 tables)
8. ⚠️ **Service time boundaries** (lunch/dinner windows)
9. ⚠️ **Turn duration by party size**
10. ⚠️ **Buffer times** between bookings

### Optimizations (Preferred but flexible)

11. 💡 **Minimize overage** (waste)
12. 💡 **Minimize table count** (simpler service)
13. 💡 **Zone balance** (distribute load)
14. 💡 **Preserve scarce tables** (yield management)
15. 💡 **Minimize fragmentation** (keep zones cohesive)

---

## Key Algorithms

### 1. Service Detection

**Input**: DateTime
**Output**: ServiceKey ("lunch" | "dinner" | null)

**Algorithm**:

1. Convert DateTime to restaurant timezone
2. Extract time of day (hour:minute)
3. Check each service in `serviceOrder`
4. Return first service where time falls in `[start, end]`
5. Return `null` if no match

**Source**: `server/capacity/policy.ts:237`

### 2. Turn Duration Calculation

**Input**: Party size, Service
**Output**: Duration in minutes

**Algorithm**:

1. Get service's `turnBands`
2. Find first band where `maxPartySize >= partySize`
3. Return that band's `durationMinutes`
4. If no band found, return largest band's duration

**Source**: `server/capacity/policy.ts:272-300`

### 3. Table Selection

**Input**: Party size, date/time, zone (optional)
**Output**: Ranked list of table combinations

**Algorithm**:

1. Load all tables for restaurant
2. Filter by availability criteria (active, status, zone, etc.)
3. If combinations enabled, generate all valid k-combinations (k ≤ kMax)
4. For each combination:
   - Check capacity ≥ party size
   - Check overage ≤ maxOverage
   - Check adjacency (if required)
   - Check time conflicts
   - Calculate score
5. Sort by score (ascending)
6. Return top N candidates

**Source**: `server/capacity/selector.ts`, `server/capacity/table-assignment/availability.ts`

---

## Exceptions & Edge Cases

### Large Parties

**Issue**: Party size exceeds max configurable tables × largest table capacity
**Handling**: Return "Insufficient global capacity" error
**Solution**: Manual handling required

### Bar Tables

**Rule**: Bar tables (category: "bar") are available for lunch and dinner bookings
**Reason**: Drinks-only bookings removed; bar tables follow standard assignment rules
**Source**: `server/capacity/table-assignment/quote.ts`

### Booking Window Fallback

**Issue**: Booking time doesn't match any service definition
**Handling**: Use fallback calculation based on turn duration
**Metadata**: `usedFallback: true`, `fallbackService: ServiceKey`

### Policy Drift

**Issue**: Floor plan or adjacency changes after hold created
**Handling**: Detect hash mismatch, reject stale confirmation
**Error**: `PolicyDriftError` with details
**Remediation**: User must refresh and reselect tables

**Source**: `server/capacity/table-assignment/types.ts:65`

---

## Data Integrity Rules

### Referential Integrity

1. **Booking → Restaurant**: Must reference valid restaurant
2. **Table → Zone**: Must reference valid zone
3. **Assignment → Booking**: Must reference valid booking
4. **Assignment → Table**: Must reference valid table
5. **Hold → Booking**: Must reference valid booking

### Temporal Constraints

1. **Booking end > start**: End time must be after start time
2. **Hold expiration**: `expires_at` must be in future when created
3. **Assignment window**: Must align with booking time + duration

### Exclusion Constraints

1. **Table assignments**: No overlapping time windows for same table
2. **Table holds**: No overlapping holds for same table (when strict)

**Database**: PostgreSQL exclusion constraints enforce these

---

## Summary

This document catalogs **all business logic** in SajiloReserveX:

- ✅ **16 core business rules** (table mobility, capacity, adjacency, etc.)
- ✅ **30+ feature flags** controlling behavior
- ✅ **6 booking statuses** with defined transitions
- ✅ **2 service periods** (lunch, dinner) with turn durations
- ✅ **5 scoring weights** for table optimization
- ✅ **7 validation checks** for manual selection
- ✅ **3 key algorithms** (service detection, turn calculation, table selection)

**Maintenance**: Update this document when adding new business rules.

**Version Control**: All rules should have corresponding code/tests in git.
