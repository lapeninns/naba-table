```mermaid
sequenceDiagram
    participant Staff as Staff/OPS Dashboard
    participant API as /api/ops/bookings/[id]
    participant ModFlow as beginBookingModificationFlow
    participant SideEffects as enqueueBookingUpdatedSideEffects
    participant Guest as eleanor.rogers99@gmail.com

    Staff->>API: PATCH /api/ops/bookings/[id]<br/>(change time/tables)

    Note over API: requiresTableRealignment = true

    API->>ModFlow: beginBookingModificationFlow()

    Note over ModFlow: 1. Set status = "pending"<br/>2. Clear table assignments

    ModFlow->>ModFlow: attemptInlineModificationAssign()

    Note over ModFlow: ✅ Inline auto-assign succeeds!<br/>Status: "pending" → "confirmed"

    ModFlow->>Guest: ✉️ EMAIL #1<br/>"Changes Confirmed ✅"<br/>(sendBookingModificationConfirmedEmail)

    ModFlow-->>API: Return updated booking<br/>(status = "confirmed")

    Note over API: Log audit event

    API->>SideEffects: enqueueBookingUpdatedSideEffects()

    Note over SideEffects: Check status transitions:<br/>• transitionedToPending? NO<br/>• confirmedFromPending? NO<br/>(prev="confirmed", curr="confirmed")

    Note over SideEffects: Guards don't match!<br/>Falls through to "updated" email

    SideEffects->>Guest: ✉️ EMAIL #2<br/>"Changes Confirmed ✅"<br/>(sendBookingUpdateEmail)

    API-->>Staff: 200 OK

    Note over Guest: 😕 Received 2 identical emails

    style Guest fill:#ffcccc
    style ModFlow fill:#ccffcc
    style SideEffects fill:#ffffcc
```

## Email Flow Breakdown

### Path 1: Modification Flow (Direct)

```
beginBookingModificationFlow
  ↓
attemptInlineModificationAssign
  ↓ (success)
sendBookingModificationConfirmedEmail
  ↓
dispatchEmail('modification_confirmed', booking)
  ↓
EMAIL: "Changes Confirmed ✅"
```

### Path 2: Side Effects Handler (After Modification)

```
enqueueBookingUpdatedSideEffects
  ↓
processBookingUpdatedSideEffects
  ↓ (no guard match)
sendBookingUpdateEmail
  ↓
dispatchEmail('modification_confirmed', booking)
  ↓
EMAIL: "Changes Confirmed ✅"
```

## State Transitions

```
┌─────────────────────────────────────────────────────────────┐
│ Initial State: confirmed                                    │
└─────────────────────────────────────────────────────────────┘
                     │
                     ▼
          ┌─────────────────────┐
          │ Staff modifies time │
          └─────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ ModFlow Step 1: status = "pending" (table reassignment)    │
│ auto_assign_last_result = null                             │
└─────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ ModFlow Step 2: Inline auto-assign SUCCEEDS                │
│ status = "confirmed"                                        │
│ auto_assign_last_result = {success: true, emailSent: true} │
└─────────────────────────────────────────────────────────────┘
                     │
                     ├──────────────────────────────────────────┐
                     │                                          │
                     ▼                                          ▼
          ┌──────────────────┐                    ┌────────────────────┐
          │ ✉️ EMAIL #1 SENT │                    │ Return to API      │
          └──────────────────┘                    └────────────────────┘
                                                              │
                                                              ▼
                                              ┌────────────────────────────┐
                                              │ Side Effects Triggered     │
                                              │ prev: confirmed            │
                                              │ curr: confirmed            │
                                              └────────────────────────────┘
                                                              │
                                                              ▼
                                                   ┌──────────────────┐
                                                   │ ✉️ EMAIL #2 SENT │
                                                   └──────────────────┘
```

## The Bug in Guard Logic

```typescript
// server/jobs/booking-side-effects.ts, Line 638-754

const transitionedToPending =
  (currStatus === "pending" || currStatus === "pending_allocation") &&
  currStatus !== prevStatus;
  // ❌ FALSE: curr="confirmed", prev="confirmed"

const confirmedFromPending =
  (prevStatus === "pending" || prevStatus === "pending_allocation") &&
  currStatus === "confirmed";
  // ❌ FALSE: prev="confirmed", not "pending"

// Line 712-713
if (transitionedToPending || confirmedFromPending) {
  return;  // ❌ DOESN'T EXECUTE
}

// Line 716-747
if (!SUPPRESS_EMAILS && current.customer_email && ...) {
  // ✅ EXECUTES - No guard prevents it!
  await sendBookingUpdateEmail(current as BookingRecord);
  // ✉️ EMAIL #2 SENT
}
```

### Why the Guards Fail

The guards only check for:

1. **Transition TO pending** (e.g., needs manual assignment)
2. **Transition FROM pending TO confirmed** (e.g., manual confirmation)

But they DON'T check for: 3. **✗ confirmed → pending → confirmed** (modification with inline auto-assign)

In the modification flow:

- **Before ModFlow starts:** `status = "confirmed"`
- **After ModFlow succeeds:** `status = "confirmed"`
- **Guards see:** No status change = Send email ✉️

But internally, the status DOES change (confirmed → pending → confirmed), and the modification flow DOES send an email. The side effects handler doesn't know this!
