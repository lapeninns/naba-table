# Table Assignment Business Logic - Quick Reference

**Visual Summary & Cheat Sheet**

---

## 🎯 Assignment Flow (High-Level)

```
┌──────────────┐
│ New Booking  │
└──────┬───────┘
       │
       ▼
┌─────────────────────────┐
│ Quote Tables            │
│ (SmartAssignmentEngine) │
│ • Run 5 strategies      │
│ • Score & rank plans    │
│ • Select best fit       │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ Create Hold             │
│ • Reserve tables        │
│ • Capture snapshot      │
│ • TTL: 5 minutes        │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ Confirm Hold            │
│ • Validate policy       │
│ • Create assignments    │
│ • Create allocations    │
│ • Update booking status │
└──────┬──────────────────┘
       │
       ▼
┌──────────────┐
│   Success!   │
│ Tables       │
│ Assigned     │
└──────────────┘
```

---

## 🧠 Assignment Strategies (Ranked)

| Priority | Strategy        | Goal                       | Max Tables | Limit |
| -------- | --------------- | -------------------------- | ---------- | ----- |
| **5**    | Optimal Fit     | Best capacity match        | 3          | 20    |
| **4**    | Adjacency       | Adjacent tables only       | 3          | 15    |
| **4**    | Zone Preference | Preferred/historical zones | 3          | 12    |
| **3**    | Load Balancing  | Underutilized zones        | 2          | 10    |
| **2**    | Historical      | Past success patterns      | 2          | 8     |

### Scoring Formula

```typescript
score = (strategyPriority × 100)
      + capacityScore           // +50 (perfect), +20 (acceptable)
      + adjacencyBonus          // +30 (if adjacent)
      + historicalSuccess × 20  // 0-20
      - (tableCount × 5)        // Fewer tables preferred
      - slack                   // Minimize wasted seats
```

---

## 📊 Data Model (Simplified)

```
┌─────────────┐       ┌──────────────────────────┐
│  bookings   │───┬───│ booking_table_assignments│
└─────────────┘   │   └──────────┬───────────────┘
                  │              │
                  │   ┌──────────▼───────────┐
                  └───│    allocations       │
                      │ (temporal exclusion) │
                      └──────────────────────┘
                                 │
                      ┌──────────▼───────────┐
                      │  table_inventory     │
                      └──────────┬───────────┘
                                 │
                      ┌──────────▼───────────┐
                      │  table_adjacency     │
                      │  (undirected graph)  │
                      └──────────────────────┘
```

### Key Relationships

- **Assignment** → **Allocation**: 1:1 (each assignment has one allocation)
- **Booking** → **Assignments**: 1:N (multi-table = merge group)
- **Table** → **Adjacency**: N:N (bidirectional edges)

---

## ✅ Core Business Rules

### 1. Capacity Rule

```typescript
✅ totalCapacity ≥ partySize
✅ ratio = totalCapacity / partySize
✅ optimal: 1.0 ≤ ratio ≤ 1.3 (0-30% slack)
```

**Example**:

- Party of 4 → 4-top (ratio 1.0) ✅ Perfect
- Party of 4 → 5-top (ratio 1.25) ✅ Good
- Party of 4 → 8-top (ratio 2.0) ⚠️ Wasteful

### 2. Temporal Exclusivity

```sql
-- GiST exclusion constraint
EXCLUDE USING gist (
  resource_id WITH =,
  window WITH &&
)
```

**Prevents**: Two bookings assigned to same table with overlapping windows

### 3. Adjacency Requirement

```typescript
// BFS traversal
function areTablesAdjacent(tables, adjacency): boolean {
  if (tables.length <= 1) return true;

  visited = breadthFirstSearch(tables[0], adjacency);
  return visited.size === tables.length;
}
```

**Required when**: Multi-table assignment AND `requireAdjacency = true`

### 4. Zone Consistency

```sql
-- All tables must be in same zone
SELECT COUNT(DISTINCT zone_id) = 1
FROM table_inventory
WHERE id = ANY($tableIds);
```

### 5. Idempotency

```typescript
key = hash({
  tenant,
  booking,
  tables: sorted(tableIds),
  window: `${start}:${end}`,
  policy: policyVersion,
});
```

**Guarantee**: Same input → Same output → Same assignment ID

---

## ⚠️ Error Scenarios

| Error               | Code                    | Cause                           | Resolution                |
| ------------------- | ----------------------- | ------------------------------- | ------------------------- |
| Assignment Conflict | `ASSIGNMENT_CONFLICT`   | Table already allocated         | Retry with new tables     |
| Policy Drift        | `POLICY_DRIFT`          | Policy/zones/adjacency changed  | Auto-requote (if enabled) |
| Validation Error    | `ASSIGNMENT_VALIDATION` | Insufficient capacity/adjacency | Select different tables   |
| Hold Expired        | `HOLD_EXPIRED`          | TTL exceeded                    | Create new hold           |
| Repository Error    | `REPOSITORY_ERROR`      | Database failure                | Retry with backoff        |

---

## 🔄 Hold Lifecycle

```
Create Hold (TTL: 5 min)
         │
         ▼
    [Active Hold]
         │
    ┌────┴────┐
    ▼         ▼
Confirm    Expire/Error
    │         │
    ▼         ▼
Release   Release
    │         │
    └────┬────┘
         ▼
    [Released]
```

### Hold Metadata (Policy Snapshot)

```json
{
  "policyVersion": "policy-hash-v3",
  "selection": {
    "snapshot": {
      "zoneIds": ["zone-main"],
      "adjacency": {
        "undirected": true,
        "edges": ["t1->t2", "t2->t3"],
        "hash": "adj-hash-123"
      }
    }
  }
}
```

**Purpose**: Detect drift between hold creation and confirmation

---

## 🧪 Testing Checklist

### Unit Tests

- ✅ Capacity validation (sufficient/insufficient)
- ✅ Adjacency BFS (connected/disconnected)
- ✅ Idempotency key generation (deterministic)
- ✅ Strategy scoring (all 5 strategies)

### Integration Tests

- ✅ `assign_tables_atomic_v2` RPC
- ✅ Overlap constraint enforcement
- ✅ Idempotent retries
- ✅ Merge group creation

### E2E Tests

- ✅ Full auto-assignment flow
- ✅ Manual staff assignment
- ✅ Policy drift recovery
- ✅ Multi-table adjacency

---

## 📈 Performance Tips

### Query Optimization

```sql
-- Use GiST index for overlap checks
CREATE INDEX allocations_resource_window_idx
  ON allocations USING gist (resource_id, window);

-- Preload adjacency for zone
SELECT table_a_id, table_b_id
FROM table_adjacency
WHERE restaurant_id = $1;
```

### Caching

```typescript
// Cache adjacency graphs (TTL: 5 min)
// Cache venue policies (TTL: 1 hour)
// Cache availability snapshots (TTL: 30 sec)
```

### Monitoring

```typescript
// Track these metrics:
- Assignment latency (P50, P95, P99)
- Hold confirmation success rate
- Policy drift frequency
- Conflict retry rate
- Strategy distribution
```

---

## 🚀 Quick API Reference

### Auto-Assignment

```bash
# 1. Quote tables
POST /api/capacity/quote
{
  "bookingId": "booking-123",
  "createdBy": "user-456"
}

# 2. Confirm hold
POST /api/capacity/confirm
{
  "holdId": "hold-789",
  "bookingId": "booking-123"
}
```

### Manual Assignment

```bash
POST /api/ops/bookings/:id/tables
{
  "tableId": ["table-1", "table-2"],
  "requireAdjacency": true
}
```

### Unassign

```bash
DELETE /api/ops/bookings/:id/tables/:tableId
```

---

## 🎓 Key Concepts Summary

| Concept      | Description                                 | Storage                          |
| ------------ | ------------------------------------------- | -------------------------------- |
| Assignment   | Booking ↔ Table relationship               | `booking_table_assignments`      |
| Allocation   | Resource reservation (temporal lock)        | `allocations`                    |
| Hold         | Pre-assignment temporary claim              | `table_holds`                    |
| Merge Group  | Multi-table grouping UUID                   | `merge_group_id` column          |
| Window       | Time range with buffer (tstzrange)          | `start_at`, `end_at`, `window`   |
| Adjacency    | Undirected graph of connected tables        | `table_adjacency`                |
| Policy Drift | Change in policy/zones/adjacency after hold | Detected via snapshot comparison |

---

## 📚 Learn More

- **Full Documentation**: [`TABLE_ASSIGNMENT_BUSINESS_LOGIC.md`](./TABLE_ASSIGNMENT_BUSINESS_LOGIC.md)
- **Code**: [`server/capacity/table-assignment/`](../../server/capacity/table-assignment/)
- **Database**: [`supabase/schema.sql`](../../supabase/schema.sql)
- **Migrations**: [`supabase/migrations/`](../../supabase/migrations/)

---

**Last Updated**: 2025-11-13  
**Version**: 1.0  
**Status**: ✅ Production-Ready
