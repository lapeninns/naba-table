# Table Assignment Business Logic

**Version**: 1.0  
**Last Updated**: 2025-11-13  
**Owner**: Engineering Team  
**Status**: Active

---

## Table of Contents

1. [Overview](#overview)
2. [Core Concepts](#core-concepts)
3. [Assignment Strategies](#assignment-strategies)
4. [Assignment Flow](#assignment-flow)
5. [Business Rules](#business-rules)
6. [Data Model](#data-model)
7. [API Endpoints](#api-endpoints)
8. [Error Handling](#error-handling)
9. [Examples](#examples)
10. [Testing](#testing)

---

## Overview

The Table Assignment system is responsible for matching restaurant bookings with physical table resources. It implements intelligent allocation strategies that optimize capacity utilization while ensuring guest satisfaction through adjacency requirements, zone preferences, and capacity matching.

### Key Objectives

- **Optimize Capacity**: Maximize table utilization across service periods
- **Ensure Adjacency**: Large parties receive adjacent tables when required
- **Zone Preference**: Respect explicit and historical zone assignments
- **Prevent Conflicts**: Guarantee no double-booking via temporal overlap detection
- **Idempotency**: Support safe retries through deterministic idempotency keys
- **Policy Consistency**: Detect and recover from policy drift between planning and confirmation

---

## Core Concepts

### 1. Assignment vs. Allocation

#### **Assignment** (`booking_table_assignments`)

- **Purpose**: Links a booking to specific table(s)
- **Scope**: Booking-centric relationship
- **Contains**: Table IDs, assignment window, merge group, idempotency key
- **Lifecycle**: Created during assignment, updated during window sync, deleted on unassignment

#### **Allocation** (`allocations`)

- **Purpose**: Reserves table capacity during a time window
- **Scope**: Resource-centric (generic: tables, rooms, equipment)
- **Contains**: Resource type, resource ID, time window (tstzrange), shadow flag
- **Lifecycle**: Created with assignment, enforces overlap constraints via exclusion

**Relationship**:

- Each assignment has a corresponding allocation
- Allocations enforce temporal exclusivity
- Assignments track booking-specific metadata (merge groups, idempotency)

### 2. Time Windows

```typescript
interface BookingWindow {
  block: {
    start: DateTime; // Booking start time
    end: DateTime; // Booking end time + buffer
  };
  buffer: {
    before: number; // Minutes before (typically 0)
    after: number; // Minutes after (default: 15-30 min)
  };
}
```

**Window Calculation**:

1. Start time: `booking.start_at` or derived from `booking_date + start_time`
2. End time: `booking.end_at` or `start + duration + buffer`
3. Buffer: Configurable via venue policy (default 15 min for cleanup/turnover)

**Storage**:

- `booking_table_assignments.assignment_window` (generated column)
- `allocations.window` (tstzrange with exclusion constraint)

### 3. Holds (Pre-Assignment Reservations)

A **hold** is a temporary claim on tables before final confirmation:

```typescript
interface TableHold {
  id: string;
  restaurant_id: string;
  booking_id: string | null;
  zone_id: string | null;
  expires_at: string;
  metadata: {
    policyVersion: string; // Policy hash at creation
    selection: {
      snapshot: {
        zoneIds: string[]; // Zone memberships frozen
        adjacency: {
          undirected: boolean;
          edges: string[]; // Adjacent table pairs
          hash: string; // Checksum for drift detection
        };
      };
    };
  };
  table_hold_members: Array<{ table_id: string }>;
}
```

**Hold Lifecycle**:

1. **Create**: `quoteTablesForBooking` → Smart engine selects optimal tables
2. **Validate**: Policy drift check (zones, adjacency, capacity)
3. **Confirm**: `confirmHoldAssignment` → Converts hold to assignments + allocations
4. **Release**: Manual or automatic (on confirm, error, or expiry)

**Policy Drift Protection**:

- Captures zone/adjacency snapshot at hold creation
- Validates snapshot matches at confirmation
- Triggers auto-requote if drift detected (when `feature.policy.requote.enabled`)

### 4. Merge Groups

When a booking requires **multiple tables** (e.g., party of 12 using 2x 6-tops):

```typescript
interface MergeGroup {
  merge_group_id: string; // Shared UUID across tables
  tables: Array<{
    table_id: string;
    assignment_id: string;
    allocation_id: string;
  }>;
  adjacency_satisfied: boolean; // All tables adjacent?
  total_capacity: number;
}
```

**Merge Logic**:

- Atomic assignment via `assign_tables_atomic_v2`
- Single `merge_group_id` links all assignments
- Adjacency validation when `require_adjacency=true`
- Single allocation per table, but grouped via `merge_group_id`

---

## Assignment Strategies

The system uses multiple strategies ranked by priority and success rate:

### 1. **Optimal Fit Strategy** (Priority: 5)

```typescript
{
  name: "optimal_fit",
  priority: 5,
  evaluate: (context) => generatePlans(context, {
    maxTables: 3,
    limit: 20
  })
}
```

**Goal**: Find tables with capacity closest to party size  
**Scoring**:

- ✅ **+50 points**: Capacity ratio 1.0 - 1.3 (perfect fit)
- ✅ **+20 points**: Capacity ratio 1.3 - 1.6 (acceptable)
- ✅ **+30 points**: Adjacent tables (when multi-table)
- ❌ **-5 points**: Per table (favor fewer tables)
- ❌ **-1 point**: Per slack seat (minimize wasted capacity)

**Example**:

```
Party of 8:
- Option A: 1x 8-top (ratio 1.0) → Score: 150
- Option B: 1x 10-top (ratio 1.25) → Score: 145
- Option C: 2x 4-top (ratio 1.0, adjacent) → Score: 175 ✅ BEST
```

### 2. **Adjacency Strategy** (Priority: 4)

```typescript
{
  name: "adjacency",
  priority: 4,
  evaluate: (context) => generatePlans(context, {
    maxTables: 3,
    requireAdjacency: true,
    limit: 15
  })
}
```

**Goal**: Only propose adjacent table combinations  
**Algorithm**:

- Loads `table_adjacency` graph (undirected edges)
- BFS/DFS to verify connectivity
- Rejects plans where tables are disconnected

**Graph Structure**:

```sql
-- table_adjacency (undirected)
table_a_id | table_b_id
-----------|-----------
uuid-1     | uuid-2    -- Table 1 adjacent to Table 2
uuid-2     | uuid-3    -- Table 2 adjacent to Table 3
-- Implies: Tables {1,2,3} form connected component
```

### 3. **Zone Preference Strategy** (Priority: 4)

```typescript
{
  name: "zone_preference",
  priority: 4,
  evaluate: (context) => {
    const zoneId = context.booking.assigned_zone_id
                   ?? pickDominantZone(context);
    return generatePlans(context, { zoneId, maxTables: 3 });
  }
}
```

**Goal**: Prefer historically successful zones  
**Zone Selection**:

1. Explicit `booking.assigned_zone_id` (staff override)
2. Dominant zone (largest available capacity)
3. Fallback to any zone

**Benefits**:

- Consistent service (same server section)
- Reduced staff walking distance
- VIP area preferences

### 4. **Load Balancing Strategy** (Priority: 3)

```typescript
{
  name: "load_balancing",
  priority: 3,
  evaluate: (context) => {
    const zoneId = pickUnderutilizedZone(context);
    return generatePlans(context, { zoneId, maxTables: 2 });
  }
}
```

**Goal**: Distribute bookings across zones evenly  
**Scoring**: Selects zone with **highest** `available / capacity` ratio

**Example**:

```
Zone A: 5 available / 10 total = 0.50
Zone B: 8 available / 10 total = 0.80 ✅ SELECTED
Zone C: 2 available / 10 total = 0.20
```

### 5. **Historical Strategy** (Priority: 2)

```typescript
{
  name: "historical_success",
  priority: 2,
  evaluate: (context) => {
    const successRate = await getHistoricalSuccessRate("historical_success");
    return generatePlans(context, { maxTables: 2, limit: 8 });
  }
}
```

**Goal**: Learn from past assignment outcomes  
**Data Source**: `booking_assignment_attempts` table  
**Lookback**: 7 days (configurable)  
**Scoring**: `+20 * successRate` where `successRate = successes / total_attempts`

---

## Assignment Flow

### Flow 1: Auto-Assignment (New Booking)

```
┌─────────────────┐
│  New Booking    │
│  Created        │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  quoteTablesForBooking()        │
│  - Build assignment context     │
│  - Run strategies (5 total)     │
│  - Rank plans by score          │
│  - Create hold on best plan     │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  createManualHold()             │
│  - Validate adjacency           │
│  - Check overlaps               │
│  - Capture policy snapshot      │
│  - Insert hold + members        │
│  - Return hold ID + expires_at  │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  confirmHoldAssignment()        │
│  - Validate policy drift        │
│  - Lock tables (FOR UPDATE)     │
│  - Create allocations           │
│  - Create assignments           │
│  - Update booking status        │
│  - Release hold                 │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────┐
│  Booking        │
│  Confirmed      │
│  Tables         │
│  Assigned       │
└─────────────────┘
```

### Flow 2: Manual Assignment (Staff Override)

```
┌─────────────────┐
│  Staff Selects  │
│  Tables         │
│  (UI)           │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  evaluateManualSelection()      │
│  - Load tables                  │
│  - Check capacity               │
│  - Validate adjacency (opt)     │
│  - Return validation result     │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  createManualHold()             │
│  - Same as auto flow            │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  assignTableToBooking()         │
│  - Create plan signature        │
│  - commitPlan() via orchestrator│
│  - Sync assignments             │
│  - Return assignment_id         │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────┐
│  Tables         │
│  Assigned       │
└─────────────────┘
```

### Flow 3: Policy Drift Recovery

```
┌─────────────────────────────────┐
│  confirmHoldAssignment()        │
│  - Detect policy drift          │
│    (zones changed, adjacency    │
│     redefined, policy updated)  │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  PolicyDriftError thrown        │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  confirmWithPolicyRetry()       │
│  (if feature.policy.requote     │
│   .enabled = true)              │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  1. Release old hold            │
│  2. Re-quote tables             │
│  3. Create new hold             │
│  4. Retry confirmation          │
│  (max 2 attempts by default)    │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────┐
│  Success or     │
│  Final Failure  │
└─────────────────┘
```

---

## Business Rules

### Rule 1: Capacity Matching

**Requirement**: Assigned table capacity ≥ party size

```typescript
totalCapacity = sum(table.capacity for table in selectedTables)
if (totalCapacity < booking.party_size) {
  throw new Error("Insufficient capacity");
}
```

**Slack**: Acceptable over-capacity is **30%** (configurable)

```typescript
const slack = totalCapacity - partySize;
const ratio = totalCapacity / partySize;
const acceptable = ratio >= 1.0 && ratio <= 1.3;
```

### Rule 2: Temporal Exclusivity

**Requirement**: No overlapping allocations for the same table

```sql
-- Enforced by exclusion constraint
ALTER TABLE allocations
  ADD CONSTRAINT allocations_no_overlap
  EXCLUDE USING gist (
    restaurant_id WITH =,
    resource_type WITH =,
    resource_id WITH =,
    window WITH &&
  )
  WHERE (shadow = false);
```

**Window Format**: `tstzrange('[start, end)')` (inclusive start, exclusive end)

**Conflict Detection**:

```sql
SELECT EXISTS (
  SELECT 1 FROM allocations
  WHERE resource_type = 'table'
    AND resource_id = $1
    AND window && tstzrange($2, $3, '[)')
    AND shadow = false
);
```

### Rule 3: Adjacency Requirements

**Trigger**: Multi-table assignments (party > single table capacity)

**Validation**:

```typescript
function areTablesAdjacent(tables: Table[], adjacency: Map<string, Set<string>>): boolean {
  if (tables.length <= 1) return true;

  const queue = [tables[0].id];
  const visited = new Set([tables[0].id]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adjacency.get(current) || new Set();

    for (const neighbor of neighbors) {
      if (!tables.some((t) => t.id === neighbor)) continue;
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push(neighbor);
    }
  }

  return visited.size === tables.length;
}
```

**Override**: Staff can disable with `requireAdjacency: false`

### Rule 4: Zone Consistency

**Requirement**: All tables in merge group must be in same zone

```sql
SELECT COUNT(DISTINCT zone_id) = 1
FROM table_inventory
WHERE id = ANY($1::uuid[]);
```

**Enforcement**: Database constraint in `assign_tables_atomic_v2`

### Rule 5: Idempotency

**Requirement**: Identical requests return identical results

**Deterministic Key Generation**:

```typescript
function createDeterministicIdempotencyKey(params: {
  tenantId: string;
  bookingId: string;
  tableIds: string[];
  startAt: string;
  endAt: string;
  policyVersion: string;
}): string {
  const sorted = params.tableIds.slice().sort();
  const payload = {
    tenant: params.tenantId,
    booking: params.bookingId,
    tables: sorted.join(','),
    window: `${params.startAt}:${params.endAt}`,
    policy: params.policyVersion,
  };
  return computePayloadChecksum(payload);
}
```

**Ledger**: `booking_assignment_idempotency`

```sql
CREATE TABLE booking_assignment_idempotency (
  booking_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  table_ids uuid[] NOT NULL,
  assignment_window tstzrange NOT NULL,
  table_set_hash text,  -- MD5 of sorted table IDs
  created_at timestamptz DEFAULT now(),
  UNIQUE (booking_id, idempotency_key)
);
```

### Rule 6: Active Table Validation

**Requirement**: Only active tables can be assigned

```sql
SELECT * FROM table_inventory
WHERE id = ANY($1::uuid[])
  AND active = true
  AND zone_id IS NOT NULL;
```

**Inactive Reasons**:

- `active = false` (table removed/disabled)
- `zone_id IS NULL` (table not assigned to zone)
- `mobility != 'fixed'` (movable tables excluded in some contexts)

### Rule 7: Hold Expiry

**Default TTL**: 300 seconds (5 minutes)

```typescript
const DEFAULT_HOLD_TTL_SECONDS = 300;

const expiresAt = new Date(Date.now() + holdTtlSeconds * 1000);
```

**Auto-Release**: Background job or manual release on confirm/error

**Grace Period**: Holds can be confirmed slightly after expiry (< 10s tolerance)

---

## Data Model

### Core Tables

#### `booking_table_assignments`

```sql
CREATE TABLE booking_table_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES table_inventory(id),
  slot_id uuid REFERENCES booking_slots(id),
  assigned_by uuid REFERENCES auth.users(id),
  assigned_at timestamptz DEFAULT now(),
  start_at timestamptz,
  end_at timestamptz,
  assignment_window tstzrange GENERATED ALWAYS AS (tstzrange(start_at, end_at, '[)')) STORED,
  allocation_id uuid REFERENCES allocations(id) ON DELETE SET NULL,
  merge_group_id uuid,
  idempotency_key text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Prevent duplicate assignments
CREATE UNIQUE INDEX booking_table_assignments_unique_table_slot
  ON booking_table_assignments (booking_id, table_id, slot_id)
  WHERE slot_id IS NOT NULL;
```

#### `allocations`

```sql
CREATE TABLE allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id),
  resource_type text NOT NULL CHECK (resource_type IN ('table', 'room', 'equipment')),
  resource_id uuid NOT NULL,
  window tstzrange NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  shadow boolean DEFAULT false,  -- Shadow allocations for planning (no conflict enforcement)
  is_maintenance boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Ensure no overlapping allocations per resource
  CONSTRAINT allocations_no_overlap
    EXCLUDE USING gist (
      restaurant_id WITH =,
      resource_type WITH =,
      resource_id WITH =,
      window WITH &&
    )
    WHERE (shadow = false)
);
```

#### `table_holds`

```sql
CREATE TABLE table_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id),
  booking_id uuid REFERENCES bookings(id),
  zone_id uuid REFERENCES zones(id),
  expires_at timestamptz NOT NULL,
  released_at timestamptz,
  metadata jsonb,  -- Policy snapshot + selection details
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE table_hold_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hold_id uuid NOT NULL REFERENCES table_holds(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES table_inventory(id),
  created_at timestamptz DEFAULT now()
);

-- Prevent duplicate holds on same table (unless expired/released)
CREATE UNIQUE INDEX table_hold_members_active_unique
  ON table_hold_members (table_id)
  WHERE EXISTS (
    SELECT 1 FROM table_holds h
    WHERE h.id = table_hold_members.hold_id
      AND h.released_at IS NULL
      AND h.expires_at > now()
  );
```

#### `booking_assignment_idempotency`

```sql
CREATE TABLE booking_assignment_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  table_ids uuid[] NOT NULL,
  assignment_window tstzrange NOT NULL,
  merge_group_allocation_id uuid,
  table_set_hash text,  -- MD5(array_to_string(ARRAY(SELECT unnest(table_ids) ORDER BY 1), ','))
  payload_checksum text,
  created_at timestamptz DEFAULT now(),

  UNIQUE (booking_id, idempotency_key)
);

CREATE INDEX booking_assignment_idempotency_table_set_hash_idx
  ON booking_assignment_idempotency (table_set_hash);
```

### Supporting Tables

#### `table_inventory`

```sql
CREATE TABLE table_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id),
  zone_id uuid REFERENCES zones(id),
  table_number text NOT NULL,
  capacity integer NOT NULL CHECK (capacity > 0),
  min_capacity integer,
  max_capacity integer,
  shape text CHECK (shape IN ('round', 'square', 'rectangle')),
  mobility text DEFAULT 'fixed' CHECK (mobility IN ('fixed', 'movable')),
  status table_status DEFAULT 'available',
  active boolean DEFAULT true,
  position_x numeric,
  position_y numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE (restaurant_id, table_number)
);

CREATE TYPE table_status AS ENUM (
  'available',
  'reserved',
  'occupied',
  'maintenance',
  'unavailable'
);
```

#### `table_adjacency`

```sql
CREATE TABLE table_adjacency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id),
  table_a_id uuid NOT NULL REFERENCES table_inventory(id) ON DELETE CASCADE,
  table_b_id uuid NOT NULL REFERENCES table_inventory(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),

  CHECK (table_a_id < table_b_id),  -- Enforce undirected graph (canonical order)
  UNIQUE (restaurant_id, table_a_id, table_b_id)
);

CREATE INDEX table_adjacency_table_a_idx ON table_adjacency (table_a_id);
CREATE INDEX table_adjacency_table_b_idx ON table_adjacency (table_b_id);
```

---

## API Endpoints

### 1. Quote Tables (Auto-Assignment)

**POST** `/api/capacity/quote`

```typescript
// Request
{
  bookingId: string;
  createdBy: string;
  holdTtlSeconds?: number;  // Default: 300
}

// Response (Success)
{
  hold: {
    id: string;
    expiresAt: string;  // ISO 8601
    tableIds: string[];
    zoneId: string | null;
  };
  tables: Array<{
    id: string;
    number: string;
    capacity: number;
    zoneId: string;
  }>;
  validation: {
    ok: true;
    adjacencySatisfied: boolean;
    capacityRatio: number;
  };
}

// Response (Failure)
{
  hold: null;
  reason: "NO_AVAILABILITY" | "CAPACITY_EXCEEDED" | "ZONE_UNAVAILABLE";
  validation: {
    ok: false;
    errors: string[];
  };
}
```

### 2. Confirm Hold

**POST** `/api/capacity/confirm`

```typescript
// Request
{
  holdId: string;
  bookingId: string;
  idempotencyKey?: string;
  assignedBy?: string;
}

// Response
{
  assignments: Array<{
    tableId: string;
    assignmentId: string;
    startAt: string;
    endAt: string;
    mergeGroupId: string | null;
  }>;
}

// Errors
{
  code: "HOLD_NOT_FOUND" | "HOLD_EXPIRED" | "POLICY_DRIFT" | "ASSIGNMENT_CONFLICT";
  message: string;
  details?: object;
  hint?: string;
}
```

### 3. Manual Assignment

**POST** `/api/ops/bookings/:id/tables`

```typescript
// Request
{
  tableId: string | string[];  // Single or multiple
  requireAdjacency?: boolean;  // Default: auto (based on party size)
  idempotencyKey?: string;     // Optional manual key
}

// Response
{
  assignmentId: string;
  tableAssignments: Array<{
    tableId: string;
    assignmentId: string;
    startAt: string;
    endAt: string;
  }>;
}
```

### 4. Unassign Table

**DELETE** `/api/ops/bookings/:id/tables/:tableId`

```typescript
// Response
{
  success: boolean;
  tableAssignments: Array<{
    tableId: string;
    assignmentId: string;
  }>; // Remaining assignments after deletion
}
```

### 5. Evaluate Manual Selection

**POST** `/api/capacity/evaluate`

```typescript
// Request
{
  bookingId: string;
  tableIds: string[];
  requireAdjacency?: boolean;
}

// Response
{
  valid: boolean;
  capacityOk: boolean;
  adjacencyOk: boolean;
  totalCapacity: number;
  partySize: number;
  capacityRatio: number;
  errors: string[];
  warnings: string[];
  tables: Array<{
    id: string;
    number: string;
    capacity: number;
    zoneId: string;
    status: string;
  }>;
}
```

---

## Error Handling

### Error Types

#### 1. **Assignment Conflict Errors**

```typescript
class AssignmentConflictError extends Error {
  code: 'ASSIGNMENT_CONFLICT';
  details: {
    conflictingBooking?: string;
    conflictingTables: string[];
    timeWindow: { start: string; end: string };
  };
}
```

**Causes**:

- Table already allocated during window
- Race condition (simultaneous assignments)
- Hold expired during confirmation

**Resolution**:

- Retry with new hold
- Select different tables
- Adjust time window

#### 2. **Policy Drift Errors**

```typescript
class PolicyDriftError extends Error {
  code: 'POLICY_DRIFT';
  kind: 'policy' | 'adjacency' | 'zones';
  driftDetails: {
    expectedHash?: string;
    actualHash?: string;
    zones?: { expected: string[]; actual: string[] };
    adjacency?: {
      expectedEdges: string[];
      actualEdges: string[];
      expectedHash: string;
      actualHash: string;
    };
  };
}
```

**Causes**:

- Restaurant updated venue policy (hours, buffers)
- Table zones reassigned
- Adjacency relationships modified

**Resolution**:

- Auto-requote (if `feature.policy.requote.enabled`)
- Manual refresh + reselect
- Display drift details to user

#### 3. **Validation Errors**

```typescript
class AssignmentValidationError extends Error {
  code: 'ASSIGNMENT_VALIDATION';
  details: {
    reason: 'CAPACITY_INSUFFICIENT' | 'TABLES_NOT_ADJACENT' | 'ZONE_MISMATCH' | 'INACTIVE_TABLE';
    context: object;
  };
}
```

**Causes**:

- Capacity < party size
- Multi-table not adjacent (when required)
- Tables from different zones
- Inactive/deleted table

**Resolution**:

- Reject request immediately
- Suggest alternative tables
- Update UI constraints

#### 4. **Repository Errors**

```typescript
class AssignmentRepositoryError extends Error {
  code: 'ASSIGNMENT_REPOSITORY_ERROR';
  cause: Error; // Original database error
}
```

**Causes**:

- Database connection failure
- Transaction timeout
- Constraint violation (unexpected)

**Resolution**:

- Retry with exponential backoff
- Circuit breaker pattern
- Alert on-call engineer

### Error Responses

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: object | string;
    hint?: string;
  };
  requestId?: string;
  timestamp: string;
}
```

### Retry Strategy

```typescript
const RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 2000,
  backoffMultiplier: 2,

  retryableErrors: [
    'ASSIGNMENT_CONFLICT',
    'ASSIGNMENT_REPOSITORY_ERROR',
    'POLICY_DRIFT', // Auto-requote
  ],

  nonRetryableErrors: ['ASSIGNMENT_VALIDATION', 'HOLD_NOT_FOUND', 'TABLES_REQUIRED'],
};
```

---

## Examples

### Example 1: Small Party (Auto-Assignment)

**Scenario**: Party of 2, booking at 18:00

```typescript
// 1. Create booking
const booking = await createBooking({
  restaurant_id: "rest-123",
  party_size: 2,
  booking_date: "2025-11-15",
  start_time: "18:00",
  duration_minutes: 90,
});

// 2. Quote tables (automatic)
const quote = await quoteTablesForBooking({
  bookingId: booking.id,
  createdBy: "system",
  holdTtlSeconds: 300,
});

// Quote Result:
{
  hold: {
    id: "hold-abc",
    expiresAt: "2025-11-15T18:05:00Z",
    tableIds: ["table-5"],  // Single 2-top
    zoneId: "zone-main",
  },
  tables: [{
    id: "table-5",
    number: "5",
    capacity: 2,
    zoneId: "zone-main",
  }],
  validation: {
    ok: true,
    adjacencySatisfied: true,  // N/A for single table
    capacityRatio: 1.0,  // Perfect fit
  },
}

// 3. Confirm assignment
const confirmation = await confirmHoldAssignment({
  holdId: "hold-abc",
  bookingId: booking.id,
  assignedBy: "system",
});

// Confirmation Result:
{
  assignments: [{
    tableId: "table-5",
    assignmentId: "assign-xyz",
    startAt: "2025-11-15T18:00:00Z",
    endAt: "2025-11-15T19:45:00Z",  // 90 min + 15 min buffer
    mergeGroupId: null,
  }],
}
```

### Example 2: Large Party (Multi-Table with Adjacency)

**Scenario**: Party of 12, requires adjacent tables

```typescript
// 1. Booking created
const booking = {
  id: "booking-456",
  party_size: 12,
  booking_date: "2025-11-15",
  start_time: "19:00",
};

// 2. Quote evaluates strategies
const strategies = [
  {
    name: "optimal_fit",
    plan: {
      tables: [
        { id: "table-10", capacity: 6 },
        { id: "table-11", capacity: 6 },
      ],
      adjacencySatisfied: true,
      totalCapacity: 12,
      slack: 0,
      score: 185,
    },
  },
  {
    name: "adjacency",
    plan: {
      tables: [
        { id: "table-8", capacity: 8 },
        { id: "table-9", capacity: 4 },
      ],
      adjacencySatisfied: true,
      totalCapacity: 12,
      slack: 0,
      score: 175,
    },
  },
];

// Best plan selected: Tables 10+11 (score 185)

// 3. Hold created with snapshot
const hold = {
  id: "hold-def",
  table_hold_members: [
    { table_id: "table-10" },
    { table_id: "table-11" },
  ],
  metadata: {
    policyVersion: "policy-hash-v3",
    selection: {
      snapshot: {
        zoneIds: ["zone-main"],
        adjacency: {
          undirected: true,
          edges: ["table-10->table-11"],
          hash: "adj-hash-123",
        },
      },
    },
  },
};

// 4. Confirmation with adjacency validation
const confirmation = await confirmHoldAssignment({
  holdId: "hold-def",
  bookingId: "booking-456",
  requireAdjacency: true,
});

// Result:
{
  assignments: [
    {
      tableId: "table-10",
      assignmentId: "assign-aaa",
      startAt: "2025-11-15T19:00:00Z",
      endAt: "2025-11-15T21:00:00Z",
      mergeGroupId: "merge-group-xyz",  // Shared ID
    },
    {
      tableId: "table-11",
      assignmentId: "assign-bbb",
      startAt: "2025-11-15T19:00:00Z",
      endAt: "2025-11-15T21:00:00Z",
      mergeGroupId: "merge-group-xyz",  // Same ID
    },
  ],
}
```

### Example 3: Manual Assignment (Staff Override)

**Scenario**: Staff manually assigns specific table

```typescript
// 1. Staff selects table 7 for booking
const evaluation = await evaluateManualSelection({
  bookingId: "booking-789",
  tableIds: ["table-7"],
});

// Evaluation:
{
  valid: true,
  capacityOk: true,  // Table 7 has capacity 4, party is 3
  adjacencyOk: true,  // N/A
  totalCapacity: 4,
  partySize: 3,
  capacityRatio: 1.33,
  errors: [],
  warnings: [],
}

// 2. Assign table
const assignment = await assignTableToBooking(
  "booking-789",
  "table-7",
  "staff-user-id",
  client,
  { idempotencyKey: "manual-override-1" }
);

// Result: "assign-manual-123"
```

### Example 4: Policy Drift Recovery

**Scenario**: Zone reassignment between hold creation and confirmation

```typescript
// 1. Hold created with table 15 in zone-patio
const hold = await createManualHold({
  bookingId: "booking-999",
  tableIds: ["table-15"],
  createdBy: "staff-id",
});

// Hold snapshot:
{
  metadata: {
    selection: {
      snapshot: {
        zoneIds: ["zone-patio"],
        adjacency: { edges: [], hash: "empty" },
      },
    },
  },
}

// 2. Admin moves table 15 from zone-patio → zone-indoor
UPDATE table_inventory
SET zone_id = 'zone-indoor'
WHERE id = 'table-15';

// 3. Confirmation detects drift
try {
  await confirmHoldAssignment({
    holdId: hold.id,
    bookingId: "booking-999",
  });
} catch (error) {
  // PolicyDriftError thrown
  {
    kind: "adjacency",
    driftDetails: {
      zones: {
        expected: ["zone-patio"],
        actual: ["zone-indoor"],
      },
    },
  }
}

// 4. Auto-requote (if enabled)
const retryResult = await confirmWithPolicyRetry({
  holdId: hold.id,
  bookingId: "booking-999",
  maxAttempts: 2,
  enableRetry: true,
});

// Retry flow:
// - Release hold-old
// - Re-quote → new hold with table in zone-indoor
// - Confirm new hold
// - Success!
```

---

## Testing

### Unit Tests

#### Test Suite: `assignment.test.ts`

```typescript
describe('Table Assignment Business Logic', () => {
  describe('Capacity Validation', () => {
    it('accepts perfect capacity match', () => {
      const result = validateCapacity({
        partySize: 4,
        tables: [{ capacity: 4 }],
      });
      expect(result.valid).toBe(true);
      expect(result.ratio).toBe(1.0);
    });

    it('accepts acceptable over-capacity (< 30%)', () => {
      const result = validateCapacity({
        partySize: 4,
        tables: [{ capacity: 5 }],
      });
      expect(result.valid).toBe(true);
      expect(result.ratio).toBe(1.25);
    });

    it('rejects insufficient capacity', () => {
      const result = validateCapacity({
        partySize: 6,
        tables: [{ capacity: 4 }],
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('Adjacency Validation', () => {
    it('validates connected tables', () => {
      const adjacency = new Map([
        ['t1', new Set(['t2'])],
        ['t2', new Set(['t1', 't3'])],
        ['t3', new Set(['t2'])],
      ]);
      const result = areTablesAdjacent([{ id: 't1' }, { id: 't2' }, { id: 't3' }], adjacency);
      expect(result).toBe(true);
    });

    it('rejects disconnected tables', () => {
      const adjacency = new Map([
        ['t1', new Set(['t2'])],
        ['t3', new Set(['t4'])],
      ]);
      const result = areTablesAdjacent([{ id: 't1' }, { id: 't3' }], adjacency);
      expect(result).toBe(false);
    });
  });

  describe('Idempotency', () => {
    it('generates same key for same inputs', () => {
      const key1 = createDeterministicIdempotencyKey({
        tenantId: 'rest-1',
        bookingId: 'book-1',
        tableIds: ['t1', 't2'],
        startAt: '2025-11-15T18:00:00Z',
        endAt: '2025-11-15T20:00:00Z',
        policyVersion: 'v1',
      });
      const key2 = createDeterministicIdempotencyKey({
        tenantId: 'rest-1',
        bookingId: 'book-1',
        tableIds: ['t2', 't1'], // Order doesn't matter
        startAt: '2025-11-15T18:00:00Z',
        endAt: '2025-11-15T20:00:00Z',
        policyVersion: 'v1',
      });
      expect(key1).toBe(key2);
    });
  });
});
```

#### Test Suite: `assignment-strategies.test.ts`

```typescript
describe('Assignment Strategies', () => {
  describe('Optimal Fit', () => {
    it('selects smallest sufficient capacity', async () => {
      const context = {
        booking: { party_size: 4 },
        availability: {
          availableTables: [
            { id: 't1', capacity: 2 },
            { id: 't2', capacity: 4 },
            { id: 't3', capacity: 8 },
          ],
        },
      };
      const plans = await optimalFitStrategy.evaluate(context);
      const best = plans[0];
      expect(best.tableIds).toEqual(['t2']);
      expect(best.totalCapacity).toBe(4);
    });
  });

  describe('Load Balancing', () => {
    it('selects underutilized zone', async () => {
      const context = {
        booking: { party_size: 2 },
        availability: {
          zones: {
            'zone-a': { available: 2, capacity: 10 }, // 20% available
            'zone-b': { available: 8, capacity: 10 }, // 80% available ✅
          },
          availableTables: [
            { id: 't1', capacity: 2, zoneId: 'zone-a' },
            { id: 't2', capacity: 2, zoneId: 'zone-b' },
          ],
        },
      };
      const plans = await loadBalancingStrategy.evaluate(context);
      expect(plans[0].zoneId).toBe('zone-b');
    });
  });
});
```

### Integration Tests

#### Test Suite: `assignTablesAtomic.test.ts`

```typescript
describe('assign_tables_atomic_v2 RPC', () => {
  it('commits via allocator repository and syncs assignments', async () => {
    const booking = await createTestBooking({ party_size: 2 });
    const tables = await createTestTables([{ capacity: 2 }]);

    const result = await assignTableToBooking(booking.id, tables[0].id, 'user-1', client, {
      idempotencyKey: 'test-key-1',
    });

    expect(result).toBeTruthy();

    // Verify assignment created
    const assignments = await getBookingTableAssignments(booking.id, client);
    expect(assignments).toHaveLength(1);
    expect(assignments[0].tableId).toBe(tables[0].id);

    // Verify allocation created
    const allocations = await client.from('allocations').select('*').eq('booking_id', booking.id);
    expect(allocations.data).toHaveLength(1);
    expect(allocations.data[0].resource_id).toBe(tables[0].id);
  });

  it('prevents double-booking via overlap constraint', async () => {
    const table = await createTestTable({ capacity: 4 });
    const booking1 = await createTestBooking({
      start_at: '2025-11-15T18:00:00Z',
      end_at: '2025-11-15T20:00:00Z',
    });
    const booking2 = await createTestBooking({
      start_at: '2025-11-15T19:00:00Z', // Overlaps!
      end_at: '2025-11-15T21:00:00Z',
    });

    // First assignment succeeds
    await assignTableToBooking(booking1.id, table.id, 'user-1', client);

    // Second assignment fails
    await expect(assignTableToBooking(booking2.id, table.id, 'user-1', client)).rejects.toThrow(
      /allocations_no_overlap|ASSIGNMENT_CONFLICT/,
    );
  });

  it('supports idempotent retries', async () => {
    const booking = await createTestBooking({ party_size: 2 });
    const table = await createTestTable({ capacity: 2 });
    const key = 'idempotent-test-1';

    // First call
    const id1 = await assignTableToBooking(booking.id, table.id, 'user-1', client, {
      idempotencyKey: key,
    });

    // Retry with same key
    const id2 = await assignTableToBooking(booking.id, table.id, 'user-1', client, {
      idempotencyKey: key,
    });

    // Same result
    expect(id1).toBe(id2);

    // Only one assignment created
    const assignments = await getBookingTableAssignments(booking.id, client);
    expect(assignments).toHaveLength(1);
  });
});
```

### E2E Tests

#### Test Suite: `table-assignment-flow.e2e.ts`

```typescript
describe('End-to-End Table Assignment', () => {
  it('completes full auto-assignment flow', async () => {
    // 1. Create booking
    const response = await fetch('/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        restaurant_id: 'test-rest',
        party_size: 4,
        booking_date: '2025-11-15',
        start_time: '19:00',
      }),
    });
    const booking = await response.json();

    // 2. Quote tables
    const quoteResp = await fetch('/api/capacity/quote', {
      method: 'POST',
      body: JSON.stringify({ bookingId: booking.id }),
    });
    const quote = await quoteResp.json();
    expect(quote.hold).toBeTruthy();
    expect(quote.hold.tableIds.length).toBeGreaterThan(0);

    // 3. Confirm hold
    const confirmResp = await fetch('/api/capacity/confirm', {
      method: 'POST',
      body: JSON.stringify({
        holdId: quote.hold.id,
        bookingId: booking.id,
      }),
    });
    const confirmation = await confirmResp.json();
    expect(confirmation.assignments.length).toBeGreaterThan(0);

    // 4. Verify booking status
    const bookingResp = await fetch(`/api/bookings/${booking.id}`);
    const updatedBooking = await bookingResp.json();
    expect(updatedBooking.status).toBe('confirmed');
  });
});
```

---

## Performance Considerations

### Query Optimization

#### 1. Overlap Detection

```sql
-- Optimized with GiST index
EXPLAIN ANALYZE
SELECT resource_id, window
FROM allocations
WHERE resource_type = 'table'
  AND resource_id = ANY($1::uuid[])
  AND window && tstzrange($2, $3, '[)')
  AND shadow = false;

-- Index: allocations_resource_window_idx (GiST)
-- Scan: Index Scan using allocations_resource_window_idx
-- Cost: ~0.50 per table check
```

#### 2. Adjacency Graph Lookup

```sql
-- Preload adjacency map for zone
SELECT table_a_id, table_b_id
FROM table_adjacency
WHERE restaurant_id = $1
  AND (table_a_id = ANY($2::uuid[]) OR table_b_id = ANY($2::uuid[]));

-- Index: table_adjacency_table_a_idx, table_adjacency_table_b_idx
-- Typical: 10-50 rows per zone
```

#### 3. Table Status Refresh

```sql
-- Batch refresh after assignments
PERFORM public.refresh_table_status(v_table_id);

-- Optimized with window-based queries
-- Avoids full table scan
```

### Caching Strategy

```typescript
// Cache adjacency graphs per restaurant (TTL: 5 minutes)
const adjacencyCache = new Map<
  string,
  {
    edges: Map<string, Set<string>>;
    expiresAt: number;
  }
>();

// Cache venue policies (TTL: 1 hour)
const policyCache = new Map<
  string,
  {
    policy: VenuePolicy;
    version: string;
    expiresAt: number;
  }
>();

// Cache table availability snapshots (TTL: 30 seconds)
const availabilityCache = new Map<
  string,
  {
    snapshot: AvailabilitySnapshot;
    expiresAt: number;
  }
>();
```

### Monitoring

```typescript
// Record assignment metrics
await recordObservabilityEvent({
  source: 'capacity.assignment',
  eventType: 'assignment.completed',
  restaurantId: booking.restaurant_id,
  bookingId: booking.id,
  context: {
    strategy: 'optimal_fit',
    tableCount: 2,
    duration: Date.now() - startTime,
    attemptCount: 1,
  },
});

// Key metrics to track:
// - Assignment latency (P50, P95, P99)
// - Hold confirmation success rate
// - Policy drift frequency
// - Conflict retry rate
// - Strategy selection distribution
```

---

## Appendices

### Appendix A: Database Functions

#### `assign_tables_atomic_v2`

See: [`supabase/schema.sql`](../../supabase/schema.sql) (lines 570-800)

**Purpose**: Atomically assign multiple tables with overlap detection and adjacency validation

**Key Features**:

- Row-level locking (`FOR UPDATE`)
- Temporal overlap validation
- Zone consistency check
- Merge group generation
- Idempotency ledger update

#### `confirm_hold_assignment_tx`

See: [`supabase/migrations/20251107063000_confirm_hold_assignment_tx.sql`](../../supabase/migrations/20251107063000_confirm_hold_assignment_tx.sql)

**Purpose**: Confirm hold, create assignments, transition booking status atomically

**Key Features**:

- Policy drift validation
- Booking status transition
- Hold release
- Assignment window sync

#### `sync_confirmed_assignment_windows`

See: [`supabase/migrations/20251110120000_sync_assignment_windows.sql`](../../supabase/migrations/20251110120000_sync_assignment_windows.sql)

**Purpose**: Update assignment and allocation windows after confirmation

**Key Features**:

- Bulk window updates
- Idempotency ledger sync
- Payload checksum verification

### Appendix B: TypeScript Types

```typescript
// Core domain types
export type TableAssignmentMember = {
  tableId: string;
  assignmentId: string;
  startAt: string;
  endAt: string;
  mergeGroupId: string | null;
};

export type AssignmentPlan = {
  id: string;
  tableIds: string[];
  tables: Table[];
  totalCapacity: number;
  slack: number;
  adjacencySatisfied: boolean;
  zoneId: string | null;
  metadata?: Record<string, unknown>;
};

export type AssignmentStrategy = {
  name: string;
  priority: number;
  evaluate: (context: AssignmentContext) => Promise<AssignmentPlan[]>;
};

export type AssignmentContext = {
  booking: BookingWithAssignmentState;
  timeSlot: TimeSlot;
  availability: AvailabilitySnapshot;
  adjacency: Map<string, Set<string>>;
  includePendingHolds: boolean;
};

export type PolicyDriftDetails = {
  expectedHash?: string;
  actualHash?: string;
  zones?: { expected: unknown; actual: unknown };
  adjacency?: {
    expectedEdges?: string[];
    actualEdges?: string[];
    expectedHash?: string;
    actualHash?: string;
  };
  raw: unknown;
};
```

### Appendix C: Feature Flags

```bash
# Allocator v2 (required for all assignment operations)
FEATURE_ALLOCATOR_V2_ENABLED=true

# Auto-requote on policy drift
FEATURE_POLICY_REQUOTE_ENABLED=true

# Hold conflict enforcement (session-scoped)
FEATURE_HOLD_STRICT_CONFLICTS_ENABLED=true

# Assignment pipeline (background job)
# Retired; legacy planner is the default and related flags have been removed.
```

### Appendix D: Migration History

| Migration        | Date       | Description                       |
| ---------------- | ---------- | --------------------------------- |
| `20251026105000` | 2025-10-26 | Initial `assign_tables_atomic_v2` |
| `20251027164000` | 2025-10-27 | Precise window alignment          |
| `20251027211000` | 2025-10-27 | Undirected adjacency support      |
| `20251028034500` | 2025-10-28 | Alias fix for merge groups        |
| `20251101170000` | 2025-11-01 | Booking logic hardening           |
| `20251102115500` | 2025-11-02 | Idempotency ledger extended       |
| `20251106110000` | 2025-11-06 | Atomic confirm with transition    |
| `20251107063000` | 2025-11-07 | `confirm_hold_assignment_tx`      |
| `20251110120000` | 2025-11-10 | Window sync RPC                   |
| `20251113090000` | 2025-11-13 | Assignment pipeline foundation    |
| `20251113131500` | 2025-11-13 | Hold conflict session scope fix   |

---

## References

- [AGENTS.md](../../AGENTS.md) — SDLC workflow and policies
- [Supabase Schema](../../supabase/schema.sql) — Database DDL
- [Assignment Implementation](../../server/capacity/table-assignment/assignment.ts) — Core TypeScript logic
- Assignment Engine (retired): coordinator/pipeline code was removed; legacy planner orchestration now lives under `server/capacity/` (e.g., `table-assignment`).
- [API Routes](../../src/app/api/ops/bookings/) — REST endpoints

---

**Document Status**: ✅ Complete  
**Review Cycle**: Quarterly  
**Next Review**: 2026-02-13
