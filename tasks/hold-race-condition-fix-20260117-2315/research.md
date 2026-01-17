# Research: Hold Creation Race Condition Fix

---

task: hold-race-condition-fix
timestamp_utc: 2026-01-17T23:15:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: medium
flags: []
related_tickets: []

---

## Requirements

### Functional

- Prevent race conditions where two operators can simultaneously select the same table during hold creation
- Provide clear, actionable error messages when table conflicts occur
- Maintain system responsiveness during high-traffic periods

### Non-functional (a11y, perf, security, privacy, i18n)

- **Performance**: Soft-hold pattern must not add significant latency (target: <50ms overhead)
- **Scalability**: Solution must work with concurrent requests without database deadlocks
- **Security**: Soft-holds must be tied to authenticated sessions to prevent abuse

## Existing Patterns & Reuse

### Current Hold Creation Flow

Location: `server/capacity/table-assignment/manual.ts:358-498`

```
createManualHold()
├── evaluateManualSelection()      # Point-in-time snapshot (RACE WINDOW START)
│   ├── Load booking & compute window
│   ├── Load tables by IDs
│   ├── Load adjacency graph
│   ├── Load context bookings & holds
│   ├── buildBusyMaps() for conflicts
│   └── extractConflictsForTables()
├── buildManualChecks()            # 8 validation checks
├── loadAdjacency() for snapshot
├── computePayloadChecksum()
└── createTableHold(payload)       # RACE WINDOW END - conflict may occur here
```

### Database-Level Protection (Already in Place)

Location: `backups/public_schema_only.sql:1831-2274` (assign_tables_atomic_v2)

1. **Row-level locking**: `FOR UPDATE OF b` on bookings, `FOR UPDATE` on table_inventory
2. **Advisory locking**: `pg_advisory_xact_lock(v_lock_zone, v_lock_bucket)` - zone + hour bucket
3. **Exclusion constraints**: `allocations_no_overlap` constraint
4. **Hold conflict detection**: Checks `table_hold_windows && v_window`
5. **Idempotency ledger**: `booking_assignment_idempotency` table

### Existing Retry Pattern

Location: `server/capacity/table-assignment/policy-retry.ts:33-155`

- Catches `PolicyDriftError` and retries with fresh quote
- Max 2 attempts
- Does NOT handle hold-level race conditions specifically

## External Resources

- [PostgreSQL Advisory Locks](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS) — Used for zone+bucket locking
- [Optimistic Concurrency Control](https://en.wikipedia.org/wiki/Optimistic_concurrency_control) — Pattern we'll implement

## Constraints & Risks

### Constraints

1. Cannot change `assign_tables_atomic_v2` significantly (production-critical)
2. Must maintain backwards compatibility with existing hold creation
3. Supabase is remote-only; cannot test locally
4. Soft-holds must auto-expire to prevent orphaned locks

### Risks

1. **Deadlock potential**: If soft-hold acquisition order isn't consistent
   - Mitigation: Sort table IDs before acquiring soft-holds
2. **Orphaned soft-holds**: Network failures may leave soft-holds uncleaned
   - Mitigation: Short TTL (5-10 seconds) + background cleanup
3. **Performance impact**: Additional database round-trip
   - Mitigation: Single RPC call for soft-hold acquisition

## Open Questions (owner, due)

- Q: Should soft-holds be per-session or per-user?
  A: Per-session (more granular, prevents same user blocking themselves in different tabs)

- Q: What TTL for soft-holds?
  A: 10 seconds — enough for evaluation + hold creation, short enough to not block others long

## Recommended Direction (with rationale)

### Option 3: Soft-Hold Pattern (SELECTED)

**Why this over other options:**

| Option                | Throughput | Consistency | Complexity | Scalability                              |
| --------------------- | ---------- | ----------- | ---------- | ---------------------------------------- |
| Pessimistic Locking   | Low        | High        | Medium     | Poor - blocks during validation          |
| Optimistic + Version  | Medium     | Medium      | Low        | Good - but poor UX (late failure)        |
| **Soft-Hold Pattern** | **High**   | **High**    | **Medium** | **Excellent - early conflict detection** |

**Implementation approach:**

1. When `evaluateManualSelection()` is called, atomically acquire soft-holds on requested tables
2. Soft-holds have 10-second TTL and are tied to a session token
3. If soft-hold acquisition fails (tables already soft-held by another session), return immediate error
4. On successful hold creation, soft-holds are converted to real holds
5. If hold creation fails or times out, soft-holds auto-expire
6. Background job cleans up orphaned soft-holds every minute
