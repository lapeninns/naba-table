# Booking Status Lifecycle - Complete Guide

---

## ⚠️ **IMPORTANT: These are OPERATIONAL Statuses**

**These statuses track the RESTAURANT'S operational state, NOT customer confirmation.**

| ❌ **NOT About**          | ✅ **Actually About**           |
| ------------------------- | ------------------------------- |
| Customer confirmed coming | Whether tables are assigned     |
| Customer's RSVP status    | Restaurant's preparation status |
| Guest's commitment        | Operational readiness           |
| Reservation acceptance    | Physical table allocation       |

**Example:**

- Guest books a table → They're **committed** to come (that's the booking itself)
- Status `pending` → **Restaurant hasn't assigned tables yet**
- Status `confirmed` → **Restaurant has assigned tables** (guest can come!)
- Status `checked_in` → **Guest physically arrived** at restaurant
- Status `completed` → **Guest finished** their meal and left

**Think of it as:** "Where is this booking in the restaurant's operational workflow?"

---

## 📋 **All Booking Status Enums**

```typescript
export type OpsBookingStatus =
  | 'pending' // 1. Initial state - awaiting table assignment
  | 'pending_allocation' // 2. Auto-assign in progress
  | 'confirmed' // 3. Tables assigned (restaurant is ready)
  | 'checked_in' // 4. Guest arrived and seated
  | 'completed' // 5. Guest finished and left
  | 'cancelled' // 6. Booking cancelled
  | 'no_show'; // 7. Guest didn't show up
```

**Plain English:**

- `pending` = "We received your booking, finding you a table..."
- `confirmed` = "We've reserved Table 5 for you!" (TABLES ASSIGNED)
- `checked_in` = "Welcome! You're seated at Table 5"
- `completed` = "Thanks for dining with us!"
- `cancelled` = "Booking was cancelled"
- `no_show` = "Guest never showed up"

---

## 🎯 **Critical Business Rule: Status Must Match Table Assignments**

**RULE:** A booking's status MUST accurately reflect its table assignment state.

| Tables Assigned      | Allowed Status                         |
| -------------------- | -------------------------------------- |
| **0 tables** (none)  | `pending`, `cancelled`, `no_show`      |
| **1+ tables** (some) | `confirmed`, `checked_in`, `completed` |

**Automatic Status Corrections:**

1. **Assigning Tables** → Status becomes `confirmed`

   ```typescript
   // When tables are assigned to a 'pending' booking
   status: 'pending' → 'confirmed'  ✅
   ```

2. **Removing ALL Tables** → Status reverts to `pending`

   ```typescript
   // When last table is removed from a 'confirmed' booking
   status: 'confirmed' → 'pending'  ✅

   // Prevents invalid state: 0 tables but status = 'confirmed' ❌
   ```

3. **Editing Booking** → Clears tables, status becomes `pending`
   ```typescript
   // When guest modifies party size/time (requires re-assignment)
   - Clear all table assignments
   - status: 'confirmed' → 'pending'  ✅
   - Re-run auto-assign
   ```

**Why This Matters:**

- **Consistency:** Dashboard shows accurate state
- **Operations:** Staff knows which bookings need tables assigned
- **Guest Experience:** Guests receive correct confirmation emails

---

## 🔄 **Status Transition Matrix**

```typescript
const BOOKING_STATE_TRANSITIONS = {
  pending: ['pending', 'pending_allocation', 'confirmed', 'cancelled'],
  pending_allocation: ['pending_allocation', 'confirmed', 'cancelled'],
  confirmed: ['confirmed', 'checked_in', 'cancelled', 'no_show'],
  checked_in: ['checked_in', 'completed', 'no_show'],
  completed: ['completed'], // Terminal state
  cancelled: ['cancelled'], // Terminal state
  no_show: ['no_show', 'confirmed'], // Can undo within grace period
};
```

### **Visual Flow Diagram**

```
┌─────────┐
│ PENDING │ (Initial state - no tables assigned)
└────┬────┘
     │
     ├──────────────────────┐
     │                      │
     ▼                      ▼
┌──────────────────┐   ┌───────────┐
│ PENDING_ALLOCATION│   │ CONFIRMED │ (Tables assigned)
└────┬─────────────┘   └─────┬─────┘
     │                        │
     │                        ├────────────┐
     │                        │            │
     └────────────────────────┘            │
                              │            ▼
                              │       ┌──────────┐
                              │       │ NO_SHOW  │ (Guest didn't arrive)
                              │       └────┬─────┘
                              │            │
                              │            └──────┐ (Undo within 15 min)
                              │                   │
                              │            ┌──────┘
                              │            │
                              ▼            ▼
                         ┌─────────────┐
                         │ CHECKED_IN  │ (Guest seated)
                         └──────┬──────┘
                                │
                                ▼
                         ┌───────────┐
                         │ COMPLETED │ (Guest left) [TERMINAL]
                         └───────────┘

                         ┌───────────┐
                         │ CANCELLED │ (Booking cancelled) [TERMINAL]
                         └───────────┘
```

---

## 🎯 **Status Transition Logic**

### **1. PENDING → PENDING_ALLOCATION**

**When:** Auto-assign job starts processing

**Logic:**

```typescript
// Triggered by: server/jobs/auto-assign.ts
// NOT explicitly set in code - conceptual state
// Booking is "pending" while auto-assign is attempting to find tables
```

**Files:**

- `server/jobs/auto-assign.ts:70` - `autoAssignAndConfirmIfPossible()`

**User Actions:** None (automatic)

---

### **2. PENDING → CONFIRMED**

**When:** Tables are assigned to the booking

**Logic:**

```typescript
// Manual Assignment (New System)
// File: server/capacity/table-assignment/direct-assignment.ts:298-303
if (booking.status === 'pending') {
  await supabase
    .from('bookings')
    .update({ status: 'confirmed', updated_at: now })
    .eq('id', bookingId);
}
```

**Triggers:**

1. **Manual Assignment** - Staff assigns tables via floor plan
   - API: `POST /api/ops/bookings/{id}/assign-tables`
   - File: `server/capacity/table-assignment/direct-assignment.ts:298-303`

2. **Auto Assignment** - System automatically finds and assigns tables
   - API: Auto-assign job runs in background
   - File: `server/capacity/tables.ts` - `atomicConfirmAndTransition()`

**Business Rules:**

- Must have tables assigned (`booking_table_assignments` records created)
- Booking cannot be cancelled
- Booking cannot be completed
- Booking cannot be no_show

**User Actions:**

- **Ops Staff:** Click "Assign Tables" on floor plan
- **System:** Auto-assign job succeeds

---

### **3. PENDING → CANCELLED**

**When:** Booking is cancelled before table assignment

**Logic:**

```typescript
// File: server/bookings.ts - softCancelBooking()
// Sets status to 'cancelled' and clears table assignments
await supabase
  .from('bookings')
  .update({
    status: 'cancelled',
    updated_at: now,
    cancelled_at: now,
  })
  .eq('id', bookingId);
```

**Triggers:**

1. **Guest Cancels** - Guest cancels via their booking page
   - API: `DELETE /api/bookings/{id}`
   - File: `src/app/api/bookings/[id]/route.ts:931`

2. **Staff Cancels** - Ops staff cancels booking
   - API: `PUT /api/ops/bookings/{id}` with `status: "cancelled"`
   - Component: `BookingDetailsDialog.tsx`

**Business Rules:**

- Cannot cancel if already `completed` or `cancelled`
- Removes all table assignments
- Sends cancellation email to guest

**User Actions:**

- **Guest:** Click "Cancel Booking" button
- **Ops Staff:** Select "Cancel" from booking actions

---

### **4. CONFIRMED → CHECKED_IN**

**When:** Guest arrives and is seated at their table

**Logic:**

```typescript
// File: server/ops/booking-lifecycle/actions.ts:126-206
export function prepareCheckInTransition(options: CheckInOptions): TransitionResult {
  const targetStatus = "checked_in";

  // Validates transition is allowed
  assertCanTransition({ from: booking.status, to: targetStatus });

  const updates = {
    status: "checked_in",
    checked_in_at: performedAt.toISOString(),
    checked_out_at: null, // Clear if previously set
    updated_at: now.toISOString(),
  };

  // Creates history entry
  const history = {
    from_status: booking.status,
    to_status: "checked_in",
    changed_by: actorId,
    changed_at: now.toISOString(),
    metadata: { action: "check-in", performedAt, ... }
  };

  return { updates, history };
}
```

**Triggers:**

1. **Check-In Action** - Staff marks guest as arrived
   - API: `POST /api/ops/bookings/{id}/check-in`
   - File: `src/app/api/ops/bookings/[id]/check-in/route.ts`

**Business Rules:**

- Booking must be `confirmed` (cannot check-in cancelled/completed bookings)
- Cannot check-in if already `checked_out_at` is set
- Sets `checked_in_at` timestamp
- Creates history entry in `booking_state_history` table

**User Actions:**

- **Ops Staff:** Click "Check In" button when guest arrives

---

### **5. CHECKED_IN → COMPLETED**

**When:** Guest finishes their meal and leaves

**Logic:**

```typescript
// File: server/ops/booking-lifecycle/actions.ts:208-281
export function prepareCheckOutTransition(options: CheckOutOptions): TransitionResult {
  const targetStatus = 'completed';

  // Validation: Must be checked in first
  if (!booking.checked_in_at) {
    throw new BookingLifecycleError(
      'Booking must be checked in before check-out',
      'TRANSITION_NOT_ALLOWED',
    );
  }

  // Validation: Check-out cannot be before check-in
  ensureChronology(checkedInDate, performedAt, 'Check-out time cannot be before check-in');

  const updates = {
    status: 'completed',
    checked_out_at: performedAt.toISOString(),
    updated_at: now.toISOString(),
  };

  return { updates, history };
}
```

**Triggers:**

1. **Check-Out Action** - Staff marks guest as left
   - API: `POST /api/ops/bookings/{id}/check-out`
   - File: `src/app/api/ops/bookings/[id]/check-out/route.ts`

**Business Rules:**

- Must be `checked_in` first (cannot complete without check-in)
- `checked_out_at` must be after `checked_in_at`
- `checked_out_at` cannot be in the future
- Creates history entry
- **TERMINAL STATE** - Cannot transition out of completed

**User Actions:**

- **Ops Staff:** Click "Check Out" button when guest leaves

---

### **6. CONFIRMED → NO_SHOW**

**When:** Guest doesn't arrive for their reservation

**Logic:**

```typescript
// File: server/ops/booking-lifecycle/actions.ts:283-335
export function prepareNoShowTransition(options: NoShowOptions): TransitionResult {
  const targetStatus = 'no_show';

  // Validation: Cannot mark checked-in guest as no-show
  if (!options.allowFromCheckedIn && booking.status === 'checked_in') {
    throw new BookingLifecycleError(
      'Cannot mark a checked-in booking as no-show',
      'TRANSITION_NOT_ALLOWED',
    );
  }

  // Validation: Cannot mark checked-out booking as no-show
  if (booking.checked_out_at) {
    throw new BookingLifecycleError(
      'Cannot mark a checked-out booking as no-show',
      'TRANSITION_NOT_ALLOWED',
    );
  }

  const updates = {
    status: 'no_show',
    checked_in_at: null, // Clear timestamps
    checked_out_at: null,
    updated_at: now.toISOString(),
  };

  // Save previous state for undo
  const metadata = {
    action: 'no-show',
    previousStatus: booking.status,
    previousCheckedInAt: booking.checked_in_at,
    previousCheckedOutAt: booking.checked_out_at,
  };

  return { updates, history };
}
```

**Triggers:**

1. **No-Show Action** - Staff marks guest as no-show
   - API: `POST /api/ops/bookings/{id}/no-show`
   - File: `src/app/api/ops/bookings/[id]/no-show/route.ts`

**Business Rules:**

- Cannot mark `checked_in` as no-show (guest already seated)
- Cannot mark `checked_out` as no-show (guest already left)
- Clears `checked_in_at` and `checked_out_at` timestamps
- Saves previous state in metadata for undo
- Can be undone within 15-minute grace period

**User Actions:**

- **Ops Staff:** Click "No Show" button

---

### **7. NO_SHOW → CONFIRMED** (Undo No-Show)

**When:** Staff accidentally marked guest as no-show (within 15-minute grace period)

**Logic:**

```typescript
// File: server/ops/booking-lifecycle/actions.ts:337-405
export function prepareUndoNoShowTransition(options: UndoNoShowOptions): TransitionResult {
  const { graceMinutes = 15 } = options;

  // Must have history entry from original no-show action
  if (!historyEntry) {
    throw new BookingLifecycleError(
      'No matching history entry found to undo no-show',
      'MISSING_HISTORY',
    );
  }

  // Check if within grace period
  const minutesSinceNoShow = differenceInMinutes(now, historyChangedAt);
  const withinGrace = minutesSinceNoShow <= graceMinutes;

  // Restore previous status (usually "confirmed")
  const previousStatus = historyEntry.metadata?.previousStatus ?? 'confirmed';

  // Restore timestamps if within grace period
  let restoredCheckedInAt = null;
  let restoredCheckedOutAt = null;

  if (withinGrace) {
    restoredCheckedInAt = historyEntry.metadata?.previousCheckedInAt ?? null;
    restoredCheckedOutAt = historyEntry.metadata?.previousCheckedOutAt ?? null;
  }

  const updates = {
    status: previousStatus,
    checked_in_at: restoredCheckedInAt,
    checked_out_at: restoredCheckedOutAt,
    updated_at: now.toISOString(),
  };

  return { updates, history };
}
```

**Triggers:**

1. **Undo No-Show Action** - Staff undoes accidental no-show
   - API: `POST /api/ops/bookings/{id}/undo-no-show`
   - File: `src/app/api/ops/bookings/[id]/undo-no-show/route.ts`

**Business Rules:**

- Must be currently `no_show` status
- Must have history entry from no-show action
- **Grace Period:** 15 minutes (configurable)
- If **within grace period:** Restores original timestamps (`checked_in_at`, `checked_out_at`)
- If **after grace period:** Restores status but NOT timestamps
- Restores to previous status (usually `confirmed`)

**User Actions:**

- **Ops Staff:** Click "Undo No-Show" button (only visible for 15 min)

---

### **8. CONFIRMED → CANCELLED**

**When:** Guest or staff cancels confirmed booking

**Logic:**

```typescript
// Same as PENDING → CANCELLED
// Clears table assignments and sets status to cancelled
```

**Triggers:**

- Same as **PENDING → CANCELLED**

**Business Rules:**

- Releases assigned tables (deletes `booking_table_assignments`)
- Cannot cancel if already `completed`
- Sends cancellation email

---

## 🔒 **Terminal States**

### **Completed**

- **Cannot transition to any other state**
- Final state when guest successfully dined and left
- Preserves `checked_in_at` and `checked_out_at` timestamps

### **Cancelled**

- **Cannot transition to any other state**
- Final state when booking is cancelled
- Preserves `cancelled_at` timestamp

---

## 📊 **Status Change Tracking**

Every status change is recorded in the `booking_state_history` table:

```typescript
type BookingStateHistory = {
  id: uuid;
  booking_id: uuid;
  from_status: OpsBookingStatus;
  to_status: OpsBookingStatus;
  changed_by: uuid; // User who made the change
  changed_at: timestamp;
  reason: string | null; // Optional reason for change
  metadata: json; // Additional context (e.g., previous timestamps)
};
```

**Example History Entry:**

```json
{
  "id": "abc-123",
  "booking_id": "booking-456",
  "from_status": "confirmed",
  "to_status": "no_show",
  "changed_by": "user-789",
  "changed_at": "2025-11-19T18:30:00Z",
  "reason": "Guest did not arrive",
  "metadata": {
    "action": "no-show",
    "previousStatus": "confirmed",
    "previousCheckedInAt": null,
    "previousCheckedOutAt": null
  }
}
```

---

## 🎯 **Status-Based Permissions**

### **What Staff Can Do Based on Status:**

| Status                 | Assign Tables | Check In | Check Out | No Show | Undo No Show | Cancel |
| ---------------------- | ------------- | -------- | --------- | ------- | ------------ | ------ |
| **pending**            | ✅            | ❌       | ❌        | ❌      | ❌           | ✅     |
| **pending_allocation** | ✅            | ❌       | ❌        | ❌      | ❌           | ✅     |
| **confirmed**          | ✅            | ✅       | ❌        | ✅      | ❌           | ✅     |
| **checked_in**         | ❌            | ✅\*     | ✅        | ✅\*\*  | ❌           | ❌     |
| **completed**          | ❌            | ❌       | ✅\*      | ❌      | ❌           | ❌     |
| **cancelled**          | ❌            | ❌       | ❌        | ❌      | ❌           | ✅\*   |
| **no_show**            | ❌            | ❌       | ❌        | ✅\*    | ✅           | ❌     |

**Notes:**

- ✅ = Allowed
- ❌ = Not allowed
- ✅\* = Idempotent (can click multiple times, no change)
- ✅\*\* = Requires `allowFromCheckedIn` flag

---

## 🔧 **API Endpoints**

| Action            | Method | Endpoint                               | Status Transition          |
| ----------------- | ------ | -------------------------------------- | -------------------------- |
| **Assign Tables** | POST   | `/api/ops/bookings/{id}/assign-tables` | `pending` → `confirmed`    |
| **Check In**      | POST   | `/api/ops/bookings/{id}/check-in`      | `confirmed` → `checked_in` |
| **Check Out**     | POST   | `/api/ops/bookings/{id}/check-out`     | `checked_in` → `completed` |
| **No Show**       | POST   | `/api/ops/bookings/{id}/no-show`       | `confirmed` → `no_show`    |
| **Undo No Show**  | POST   | `/api/ops/bookings/{id}/undo-no-show`  | `no_show` → `confirmed`    |
| **Cancel**        | DELETE | `/api/bookings/{id}`                   | `*` → `cancelled`          |
| **Update Status** | PUT    | `/api/ops/bookings/{id}/status`        | Any valid transition       |

---

## 🚨 **Error Codes**

```typescript
type BookingLifecycleErrorCode =
  | 'TRANSITION_NOT_ALLOWED' // Status transition not permitted
  | 'ALREADY_IN_STATE' // Already in target status
  | 'UNKNOWN_STATUS' // Invalid status value
  | 'TIMESTAMP_INVALID' // Invalid or future timestamp
  | 'GRACE_PERIOD_EXPIRED' // Undo no-show after 15 min
  | 'MISSING_HISTORY'; // No history entry for undo
```

---

## 📝 **Example User Journeys**

### **Journey 1: Successful Booking**

```
1. Guest creates booking → PENDING
2. Auto-assign finds tables → CONFIRMED
3. Guest arrives → CHECKED_IN
4. Guest finishes meal → COMPLETED ✅
```

### **Journey 2: Guest Cancels**

```
1. Guest creates booking → PENDING
2. Auto-assign finds tables → CONFIRMED
3. Guest cancels → CANCELLED ❌
```

### **Journey 3: No-Show with Undo**

```
1. Guest creates booking → PENDING
2. Staff assigns tables manually → CONFIRMED
3. Guest doesn't arrive → NO_SHOW
4. Guest arrives 5 min late → CONFIRMED (undo within grace)
5. Guest seated → CHECKED_IN
6. Guest leaves → COMPLETED ✅
```

### **Journey 4: Manual Assignment**

```
1. Guest creates booking → PENDING
2. Staff assigns tables → CONFIRMED
3. Guest arrives → CHECKED_IN
4. Guest leaves → COMPLETED ✅
```

---

## 🔍 **Validation Rules**

### **Check-In Rules:**

- Must be `confirmed` status
- Cannot have `checked_out_at` set
- `checked_in_at` cannot be in future
- Creates history entry

### **Check-Out Rules:**

- Must have `checked_in_at` set
- `checked_out_at` must be after `checked_in_at`
- `checked_out_at` cannot be in future
- Transitions to `completed` (terminal)

### **No-Show Rules:**

- Cannot be `checked_out` (guest already left)
- Default: Cannot be `checked_in` (unless `allowFromCheckedIn: true`)
- Clears all timestamps
- Saves previous state for undo

### **Undo No-Show Rules:**

- Must have history entry
- 15-minute grace period for timestamp restoration
- After grace: Restores status only (no timestamps)

---

## 🎨 **Status Display Colors**

Typical UI color coding:

- **pending** → 🟡 Yellow (Awaiting action)
- **pending_allocation** → 🟠 Orange (Processing)
- **confirmed** → 🔵 Blue (Ready)
- **checked_in** → 🟢 Green (Active)
- **completed** → ⚫ Gray (Done)
- **cancelled** → 🔴 Red (Cancelled)
- **no_show** → 🟣 Purple (No show)

---

## 📚 **Key Files Reference**

### **Status Definitions:**

- `src/types/ops.ts:36-43` - TypeScript type definition
- `config/booking-state-machine.ts:7-15` - Transition matrix

### **Validation Logic:**

- `src/lib/booking/state-machine.ts` - Transition validation helpers
- `server/ops/booking-lifecycle/stateMachine.ts` - Server-side validation

### **Status Change Actions:**

- `server/ops/booking-lifecycle/actions.ts` - All status transition logic
- `server/capacity/table-assignment/direct-assignment.ts:298-303` - Pending→Confirmed on table assignment
- `server/capacity/table-assignment/direct-assignment.ts:523-559` - Confirmed→Pending when all tables removed (bulk)
- `src/app/api/ops/bookings/[id]/tables/[tableId]/route.ts:94-117` - Confirmed→Pending when all tables removed (single)
- `server/bookings/modification-flow.ts:86-93` - Confirmed→Pending on booking edit
- `server/bookings.ts` - Cancellation logic

### **API Routes:**

- `src/app/api/ops/bookings/[id]/check-in/route.ts` - Check-in endpoint
- `src/app/api/ops/bookings/[id]/check-out/route.ts` - Check-out endpoint
- `src/app/api/ops/bookings/[id]/no-show/route.ts` - No-show endpoint
- `src/app/api/ops/bookings/[id]/undo-no-show/route.ts` - Undo no-show endpoint
- `src/app/api/bookings/[id]/route.ts:931` - Cancellation endpoint

---

## 🎓 **Summary**

The booking lifecycle follows a strict state machine with:

- **7 possible statuses**
- **2 terminal states** (`completed`, `cancelled`)
- **1 reversible state** (`no_show` → `confirmed` within 15 min)
- **Full audit trail** in `booking_state_history` table
- **Timestamp validation** to prevent chronological errors
- **Clear error messages** for invalid transitions

All transitions are validated server-side to ensure data integrity and business rule compliance.
