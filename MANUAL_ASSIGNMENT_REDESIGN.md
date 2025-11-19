# Manual Assignment System - Redesign

## Problems with Current System

1. **Over-engineered Session Management**
   - `manual_assignment_sessions` table tracks complex state
   - Version tracking for: context, selection, policy, adjacency, tables, flags, windows, holds, assignments
   - State transitions: pending → confirming → confirmed

2. **Split Flow Causing Race Conditions**
   - Step 1: Create hold (3-minute expiration)
   - Step 2: Confirm hold
   - Problems: Hold can expire between steps, context can change, versions mismatch

3. **Multiple Failure Points (409 Conflicts)**
   - `StaleContextError` - Context version changed
   - `SessionConflictError` - Session/hold/selection version mismatch
   - `HOLD_EXPIRED` - Hold expired before confirmation
   - `HOLD_INACTIVE` - Hold status changed
   - `SELECTION_VERSION_MISMATCH` - Selection changed

4. **Complex Error Handling**
   - Frontend must handle 7+ different 409 error codes
   - Unclear to users what went wrong
   - Hard to recover from errors

## New Design: Simple Atomic Assignment

### Architecture

```
Frontend                      Backend
   │                             │
   │  POST /assign-tables        │
   │  { bookingId, tableIds }    │
   ├────────────────────────────>│
   │                             │ 1. Validate input
   │                             │ 2. Begin transaction
   │                             │ 3. Lock booking row
   │                             │ 4. Check conflicts
   │                             │ 5. Validate selection
   │                             │ 6. Insert assignments
   │                             │ 7. Commit
   │                             │
   │<────────────────────────────┤
   │  { success, assignments }   │
```

### Key Features

1. **Single API Call**
   - No hold creation step
   - No confirmation step
   - Just: "Assign these tables to this booking"

2. **Atomic Transaction**
   - All validation and assignment in one transaction
   - Either succeeds completely or fails cleanly
   - No partial states

3. **Simple Concurrency Control**
   - Use PostgreSQL row locking (`SELECT FOR UPDATE`)
   - One version number per booking (updated_at timestamp)
   - Clear conflict resolution

4. **Idempotency**
   - Client sends idempotency key
   - Duplicate requests return same result
   - Safe retries

5. **Clear Errors**
   - `CONFLICT_EXISTING_ASSIGNMENT` - Tables already assigned
   - `CONFLICT_TIME_OVERLAP` - Tables booked at this time
   - `VALIDATION_CAPACITY` - Not enough seats
   - `VALIDATION_ADJACENCY` - Tables not adjacent (if required)
   - `STALE_DATA` - Booking changed, refresh and retry

### Database Schema (Simplified)

```sql
-- Just use existing tables, no new session table needed

-- booking_table_assignments (already exists)
-- Add idempotency_key column for deduplication

ALTER TABLE booking_table_assignments
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_assignment_idempotency
ON booking_table_assignments(booking_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;
```

### API Endpoints

#### New: POST /api/ops/bookings/{bookingId}/assign-tables

**Request:**

```json
{
  "tableIds": ["uuid1", "uuid2"],
  "idempotencyKey": "client-generated-uuid",
  "requireAdjacency": false,
  "assignedBy": "user-id"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "assignments": [
    { "id": "...", "table_id": "uuid1", "booking_id": "..." },
    { "id": "...", "table_id": "uuid2", "booking_id": "..." }
  ],
  "booking": { "id": "...", "status": "confirmed", ... }
}
```

**Error Responses:**

- **400 Bad Request**
  - Invalid input (missing fields, invalid UUIDs)

- **404 Not Found**
  - Booking not found
  - Tables not found

- **409 Conflict**

  ```json
  {
    "error": "CONFLICT_EXISTING_ASSIGNMENT",
    "message": "Table 'T1' is already assigned to this booking",
    "conflictingTables": ["uuid1"]
  }
  ```

- **422 Unprocessable**
  ```json
  {
    "error": "VALIDATION_CAPACITY",
    "message": "Selected tables (4 seats) don't meet party size (6)",
    "details": {
      "partySize": 6,
      "selectedCapacity": 4,
      "deficit": 2
    }
  }
  ```

### Implementation Plan

1. **Backend:**
   - Create new simplified assignment service
   - Single transaction with proper locking
   - Clear validation logic
   - Idempotency support

2. **Frontend:**
   - Remove session management
   - Remove hold/confirm split
   - Single mutation for assignment
   - Better error UI

3. **Migration:**
   - Keep old endpoints for backward compatibility
   - Feature flag to switch between old/new
   - Gradual rollout

### Benefits

✅ **Simpler:** 1 API call instead of 2+
✅ **Faster:** No hold expiration, no version checks
✅ **More Reliable:** Atomic operations, no race conditions
✅ **Better UX:** Clear errors, instant feedback
✅ **Easier to maintain:** Less code, clearer logic
✅ **Safe:** Idempotency, proper locking, transactions

### Rollout Strategy

1. **Phase 1:** Build new system alongside old
2. **Phase 2:** Feature flag toggle
3. **Phase 3:** Test with internal users
4. **Phase 4:** Gradual rollout to all restaurants
5. **Phase 5:** Deprecate old system
6. **Phase 6:** Remove old code

### Code Organization

```
server/capacity/table-assignment/
├── direct-assignment.ts      # NEW: Simple atomic assignment
├── validation.ts              # Shared: Validation logic
├── conflicts.ts               # Shared: Conflict detection
├── manual.ts                  # OLD: Keep for backward compat
└── assignment.ts              # OLD: Keep for backward compat

src/services/ops/bookings.ts
└── assignTablesDirectly()    # NEW: Single call

src/components/features/dashboard/booking-details/
└── BookingAssignmentTabContent.tsx  # Simplified UI
```
