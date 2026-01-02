# Duplicate Email Debug: eleanor.rogers99@gmail.com

## Issue

`eleanor.rogers99@gmail.com` received 2 "Changes Confirmed ✅" emails for the same booking.

## Root Cause Analysis

### Email Sending Flow for Booking Updates

There are **TWO SEPARATE PATHS** that can send "Changes Confirmed" emails:

#### Path 1: `beginBookingModificationFlow` (Inline Modification)

**File:** `server/bookings/modification-flow.ts`  
**Lines:** 175-180

When a booking is modified (e.g., from the OPS dashboard or guest portal), the `beginBookingModificationFlow` function:

1. Transitions booking to `pending` status
2. Clears table assignments
3. Attempts inline auto-assignment
4. **If successful:** Sends `sendBookingModificationConfirmedEmail` (Line 177)
5. **If failed:** Schedules background auto-assign job

```typescript
// Line 175-180
if (!SUPPRESS_EMAILS && confirmed.customer_email?.trim()) {
  try {
    await sendBookingModificationConfirmedEmail(confirmed as BookingRecord);
  } catch (emailError) {
    console.error('[booking.modification] inline confirmation email failed', emailError);
  }
}
```

#### Path 2: `enqueueBookingUpdatedSideEffects` (Side Effects Handler)

**File:** `server/jobs/booking-side-effects.ts`  
**Lines:** 716-746

Additionally, when a booking is updated via the OPS API, `enqueueBookingUpdatedSideEffects` is called:

1. Checks if booking status changed
2. **If NOT a pending→confirmed transition:** Sends `sendBookingUpdateEmail` (Line 735 or 742)
3. This function also resolves to `dispatchEmail('modification_confirmed', booking)` which uses the **same email template** as Path 1

```typescript
// Line 716-746
if (!SUPPRESS_EMAILS && current.customer_email && current.customer_email.trim().length > 0) {
  const shouldQueueUpdate = shouldQueueEmail('updated');
  if (shouldQueueUpdate) {
    try {
      await enqueueEmailJob(
        {
          bookingId: current.id,
          restaurantId,
          type: 'updated',
          scheduledFor: null,
        },
        { jobId: `updated:${current.id}`, delayMs: 0 },
      );
    } catch (error) {
      // Fallback to inline
      await sendBookingUpdateEmail(current as BookingRecord);
    }
  } else {
    await sendBookingUpdateEmail(current as BookingRecord);
  }
}
```

#### Path 3: Background Auto-Assign Job (If Inline Fails)

**File:** `server/jobs/auto-assign.ts`  
**Lines:** 497-502

If the inline modification assignment fails, a background job is scheduled:

- On successful assignment, sends `sendBookingModificationConfirmedEmail` (Line 502)

```typescript
// Line 497-502
if (updated && !SUPPRESS_EMAILS) {
  if (inlineEmailAlreadySent) {
    logJob('email.skipped_inline_context', {
      inlineAttemptId: inlineLastResult?.attemptId ?? null,
    });
  } else if (emailVariant === 'modified') {
    await sendBookingModificationConfirmedEmail(updated as unknown as Tables<'bookings'>);
  } else {
    await sendBookingConfirmationEmail(updated as unknown as Tables<'bookings'>);
  }
}
```

### Email Template Mapping

Both paths use the **SAME headline**:

```typescript
// server/emails/bookings.ts, Line 586
case 'modification_confirmed':
  baseHeadline = 'Changes Confirmed ✅';
  baseIntro = `Your updated reservation at ${venue.name} is all set! Here are the new details.`;
  ctaLabel = 'View Booking';
  break;
```

Note: `sendBookingUpdateEmail` (Line 696-697) also maps to `modification_confirmed`:

```typescript
export const sendBookingUpdateEmail = (booking: BookingRecord) =>
  dispatchEmail('modification_confirmed', booking);
```

## The Duplicate Email Scenario

### Likely Flow for eleanor.rogers99@gmail.com:

1. **Staff updates booking** via OPS dashboard (`/api/ops/bookings/[id]` PATCH)
2. **Path 1 executes:** `beginBookingModificationFlow` is called
   - Inline auto-assignment **succeeds**
   - ✉️ **Email #1** sent via `sendBookingModificationConfirmedEmail`
3. **Path 2 executes:** `enqueueBookingUpdatedSideEffects` is called from the same API route
   - Booking has been updated (previous vs current state differ)
   - Status is NOT a pending→confirmed transition (it went pending→confirmed in Path 1)
   - ✉️ **Email #2** sent via `sendBookingUpdateEmail` (which also sends "Changes Confirmed")

### Code Evidence

**File:** `/src/app/api/ops/bookings/[id]/route.ts`  
**Lines:** 558-606

```typescript
// Line 558-580: Call modification flow
const updated: Tables<'bookings'> = requiresTableRealignment
  ? await beginBookingModificationFlow({
      client: tenantClient,
      bookingId,
      existingBooking,
      source: 'ops',
      payload: {
        /* ... */
      },
    }) // <- Email #1 sent here
  : await updateBookingRecord(tenantClient, bookingId, {
      /* ... */
    });

// Line 595-603: Side effects
await enqueueBookingUpdatedSideEffects(
  {
    previous: safeBookingPayload(existingBooking as unknown as BookingRecord),
    current: safeBookingPayload(updated),
    restaurantId: updated.restaurant_id ?? existingBooking.restaurant_id,
  },
  { supabase: tenantClient },
); // <- Email #2 sent here
```

## The Bug

The issue is in `processBookingUpdatedSideEffects` (Lines 638-754):

**Lines 647-654:** Guard against sending confirmation emails when transitioning from pending→confirmed:

```typescript
const confirmedFromPending =
  (prevStatus === 'pending' || prevStatus === 'pending_allocation') && currStatus === 'confirmed';

if (confirmedFromPending && !SUPPRESS_EMAILS && isValidEmail(current.customer_email)) {
  // Send confirmation email and schedule reminders
  // ...
  return; // <- Early return to avoid duplicate
}
```

**Lines 712-713:** Should also early return but doesn't:

```typescript
if (transitionedToPending || confirmedFromPending) {
  return; // <- This DOES return early
}
```

**Lines 716-747:** The problem - sends email for ANY other update:

```typescript
// This runs for ANY status that's not pending→confirmed or other→pending
if (!SUPPRESS_EMAILS && current.customer_email && current.customer_email.trim().length > 0) {
  // Sends "updated" email (which is "Changes Confirmed ✅")
  await sendBookingUpdateEmail(current as BookingRecord);
}
```

### Why the Guards Fail

When `beginBookingModificationFlow` succeeds:

1. **Previous status:** `confirmed` (before modification started)
2. **Current status:** `confirmed` (after inline auto-assign succeeded)
3. The guards check for:
   - `transitionedToPending`: No (both are confirmed)
   - `confirmedFromPending`: No (previous was confirmed, not pending)
4. **Result:** Email is sent because neither guard matches! ✉️

## Solution Options

### Option 1: Skip Email in Side Effects for Modification Flow

Add a flag to `enqueueBookingUpdatedSideEffects` to skip email when called after `beginBookingModificationFlow`:

```typescript
export async function enqueueBookingUpdatedSideEffects(
  payload: BookingUpdatedSideEffectsPayload,
  options?: {
    supabase?: SupabaseLike;
    skipModificationEmail?: boolean; // <- New flag
  },
) {
  // Skip email if modification flow already sent it
  if (options?.skipModificationEmail) {
    return { queued: false } as const;
  }

  await processBookingUpdatedSideEffects(payload, options?.supabase);
  return { queued: false } as const;
}
```

### Option 2: Detect Modification Flow in Side Effects

Check if the booking has a recent `auto_assign_last_result` with `emailSent: true`:

```typescript
// In processBookingUpdatedSideEffects, before sending email:
const lastResult = parseAutoAssignLastResult(current.auto_assign_last_result);
if (shouldSkipEmailForJob(lastResult)) {
  logJob('email.skipped_modification_inline', { bookingId: current.id });
  return;
}
```

### Option 3: Better Status Transition Guards

Update the guard logic to detect ANY confirmed→confirmed transition with table changes:

```typescript
const isTableReassignment =
  prevStatus === 'confirmed' &&
  currStatus === 'confirmed' &&
  // Check if table assignments changed
  hasTableAssignmentChanges(previous, current);

if (isTableReassignment) {
  // Modification flow already sent email
  return;
}
```

## Recommendation

**Use Option 1** - it's the cleanest and most explicit. The modification flow is responsible for its own email notifications, so side effects should be skipped.

### Implementation

**File:** `src/app/api/ops/bookings/[id]/route.ts`  
**Line:** ~596

```typescript
await enqueueBookingUpdatedSideEffects(
  {
    previous: safeBookingPayload(existingBooking as unknown as BookingRecord),
    current: safeBookingPayload(updated),
    restaurantId: updated.restaurant_id ?? existingBooking.restaurant_id,
  },
  {
    supabase: tenantClient,
    skipModificationEmail: requiresTableRealignment, // <- Add this flag
  },
);
```

**File:** `server/jobs/booking-side-effects.ts`  
**Lines:** 822-828

```typescript
export async function enqueueBookingUpdatedSideEffects(
  payload: BookingUpdatedSideEffectsPayload,
  options?: {
    supabase?: SupabaseLike;
    skipModificationEmail?: boolean;
  },
) {
  if (options?.skipModificationEmail) {
    console.log('[jobs][booking.updated] Skipping email - modification flow handled it');
    return { queued: false } as const;
  }

  await processBookingUpdatedSideEffects(payload, options?.supabase);
  return { queued: false } as const;
}
```

## Testing

After fix, verify:

1. ✅ Booking creation → 1 email
2. ✅ Status change (pending→confirmed) → 1 email
3. ✅ Table reassignment (confirmed→pending→confirmed) → 1 email
4. ✅ Simple updates (notes, party size, no table change) → 1 email
5. ✅ Guest-initiated modifications → 1 email

## Additional Notes

- `INSTANT_EMAIL_TYPES` (Line 98-105) includes `"updated"`, so these emails are NOT queued via Redis
- All "Changes Confirmed" emails are sent immediately inline
- The `shouldSkipEmailForJob` helper exists but isn't currently used in side effects
