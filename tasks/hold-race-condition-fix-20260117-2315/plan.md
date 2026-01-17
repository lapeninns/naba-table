# Implementation Plan: Hold Creation Race Condition Fix

---

task: hold-race-condition-fix
timestamp_utc: 2026-01-17T23:15:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: medium
flags: []
related_tickets: []

---

## Objective

We will enable **operators** to **safely select tables for hold creation without race conditions** so that **concurrent table selections provide immediate feedback and prevent wasted work**.

## Success Criteria

- [ ] Two concurrent requests for the same table result in one success, one immediate rejection (not late failure)
- [ ] Soft-hold acquisition adds <50ms latency to evaluation flow
- [ ] Soft-holds auto-expire within 10 seconds if not converted to real holds
- [ ] No deadlocks occur under concurrent load (table IDs sorted before acquisition)
- [ ] Existing hold creation flow continues to work (backwards compatible)

## Architecture & Components

### New Components

1. **`table_soft_holds` table** (Supabase)
   - Stores temporary reservations during evaluation window
   - TTL: 10 seconds
   - Indexed by table_id + window for conflict detection

2. **`acquireSoftHolds()` function** (`server/capacity/table-assignment/soft-holds.ts`)
   - Atomically acquires soft-holds on table set
   - Returns session token for later release/conversion
   - Throws `SoftHoldConflictError` if tables already held

3. **`releaseSoftHolds()` function**
   - Releases soft-holds by session token
   - Called on evaluation failure or timeout

4. **`convertSoftHoldToHold()` function**
   - Atomically converts soft-hold to real hold
   - Verifies session token ownership

5. **RPC: `acquire_soft_holds_atomic`** (Supabase function)
   - Single round-trip soft-hold acquisition
   - Uses `FOR UPDATE SKIP LOCKED` for non-blocking behavior

### Modified Components

1. **`evaluateManualSelection()`** (`manual.ts`)
   - Add soft-hold acquisition before validation
   - Pass session token through to hold creation

2. **`createManualHold()`** (`manual.ts`)
   - Accept session token from evaluation
   - Convert soft-hold to real hold atomically

### State Management

- **Soft-hold session token**: Passed from evaluation → hold creation
- **TTL expiry**: Handled by Supabase with `expires_at` column
- **Cleanup**: Background job or PostgreSQL `pg_cron` extension

## Data Flow & API Contracts

### New RPC: acquire_soft_holds_atomic

```sql
CREATE FUNCTION public.acquire_soft_holds_atomic(
  p_table_ids uuid[],
  p_window tstzrange,
  p_session_token uuid,
  p_ttl_seconds integer DEFAULT 10
) RETURNS TABLE(
  table_id uuid,
  acquired boolean,
  blocking_session uuid
)
```

**Request**:

```typescript
{
  p_table_ids: string[],      // Tables to soft-hold
  p_window: string,           // Time window as tstzrange
  p_session_token: string,    // Unique session identifier
  p_ttl_seconds: number       // TTL in seconds (default 10)
}
```

**Response**:

```typescript
{
  table_id: string,
  acquired: boolean,          // true if acquired, false if blocked
  blocking_session: string    // Session that holds the table (if blocked)
}[]
```

**Errors**:

- `SOFT_HOLD_CONFLICT` — One or more tables blocked by another session

### New Type: SoftHoldResult

```typescript
type SoftHoldResult = {
  sessionToken: string;
  acquiredTables: string[];
  blockedTables: Array<{
    tableId: string;
    blockingSession: string;
  }>;
  expiresAt: Date;
};
```

## UI/UX States

### Evaluation with Soft-Holds

| State       | Description                               | User Feedback                                   |
| ----------- | ----------------------------------------- | ----------------------------------------------- |
| `acquiring` | Soft-holds being acquired                 | Loading indicator                               |
| `acquired`  | Soft-holds successful, validation running | Validation checks shown                         |
| `blocked`   | Another operator has soft-hold            | "Table X is being selected by another operator" |
| `expired`   | Soft-hold TTL exceeded                    | "Selection expired, please try again"           |

## Edge Cases

1. **Network failure during soft-hold acquisition**
   - Soft-hold may or may not be acquired
   - Client should retry with same session token (idempotent)

2. **Operator closes tab before hold creation**
   - Soft-holds auto-expire after 10 seconds
   - No manual cleanup required

3. **Same operator, multiple tabs**
   - Each tab gets unique session token
   - Tabs compete fairly (one wins, other gets blocked)

4. **Soft-hold expires during validation**
   - Hold creation will fail with `SoftHoldExpiredError`
   - Client should re-evaluate with new soft-hold

5. **Table deleted while soft-held**
   - Soft-hold becomes orphaned
   - Cleanup job removes soft-holds for non-existent tables

## Testing Strategy

### Unit Tests

- `acquireSoftHolds()` returns correct session token
- `releaseSoftHolds()` removes soft-holds
- `convertSoftHoldToHold()` succeeds with valid token
- Conflict detection returns blocking session

### Integration Tests

- Two concurrent evaluations for same table — one blocked
- Soft-hold expiry after TTL
- Hold creation with valid soft-hold succeeds
- Hold creation with expired soft-hold fails

### Race Condition Tests

- Simulate 10 concurrent requests for same table
- Verify exactly one succeeds, others receive immediate rejection
- Verify no deadlocks (sorted table ID acquisition)

## Rollout

### Feature Flag

- `capacity.soft_holds.enabled` (namespace: `feat.capacity.soft_holds`)
- Default: `false` (disabled)
- Gradual rollout: 10% → 50% → 100%

### Monitoring

- Metric: `soft_hold.acquisition.duration_ms`
- Metric: `soft_hold.conflict.count`
- Metric: `soft_hold.expiry.count`
- Alert: `soft_hold.acquisition.duration_ms > 100ms` (P95)

### Kill-switch

- Set `capacity.soft_holds.enabled = false`
- Falls back to existing behavior (no soft-holds)
- Existing soft-holds will naturally expire

## DB Change Plan

### Target Environments

- Staging → Production
- Migration window: During low-traffic period

### Schema Changes

```sql
-- New table for soft-holds
CREATE TABLE public.table_soft_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.table_inventory(id) ON DELETE CASCADE,
  hold_window tstzrange NOT NULL,
  session_token uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),

  -- Exclusion constraint: no overlapping soft-holds for same table
  CONSTRAINT table_soft_holds_no_overlap
    EXCLUDE USING gist (table_id WITH =, hold_window WITH &&)
    WHERE (expires_at > timezone('utc', now()))
);

-- Index for cleanup queries
CREATE INDEX table_soft_holds_expires_idx
  ON public.table_soft_holds (expires_at)
  WHERE expires_at > timezone('utc', now());

-- Index for session lookups
CREATE INDEX table_soft_holds_session_idx
  ON public.table_soft_holds (session_token);
```

### Backup Reference

- Snapshot before migration
- PITR enabled

### Dry-run Evidence

- Will attach to `artifacts/db-diff.txt`

### Backfill Strategy

- No backfill needed (new table)

### Rollback Plan

1. Set feature flag to `false`
2. Drop RPC function: `DROP FUNCTION IF EXISTS acquire_soft_holds_atomic`
3. Drop table: `DROP TABLE IF EXISTS table_soft_holds`
