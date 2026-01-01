# Email Flow Fix - Ops Bookings

## Issue Found

When creating ops/walk-in bookings with auto-assign enabled, customers were receiving the **wrong email type**:

- ❌ Received: "Request Received" (pending email)
- ✅ Expected: "Confirmation" (confirmed email) - when auto-assign succeeded

## Root Cause

**Order of operations bug** in ops endpoint:

### Before (Incorrect):

```typescript
1. Create booking (status = "pending")
2. Send email ❌ (sends "request received" based on pending status)
3. Run auto-assign ✅ (changes status to "confirmed")
```

**Result**: Email already sent before status changed!

### After (Correct):

```typescript
1. Create booking (status = "pending")
2. Run auto-assign ✅ (changes status to "confirmed")
3. Send email ✅ (sends "confirmation" based on final confirmed status)
```

## Changes Made

### File: `src/app/api/ops/bookings/route.ts`

**Two locations fixed:**

1. **Non-unified validation path** (lines 840-890)
   - Moved `enqueueBookingCreatedSideEffects` AFTER `runInlineAutoAssign`
2. **Unified validation path** (lines 1003-1045)
   - Moved `enqueueBookingCreatedSideEffects` AFTER `runInlineAutoAssign`

## Email System Clarification

### Question: "Identical or Same System?"

**Answer: Same system, now identical behavior!**

| Aspect                   | Public Bookings                    | Ops/Walk-in (Before Fix)           | Ops/Walk-in (After Fix)               |
| ------------------------ | ---------------------------------- | ---------------------------------- | ------------------------------------- |
| **Auto-assign function** | `runInlineAutoAssign`              | `runInlineAutoAssign`              | `runInlineAutoAssign` ✅              |
| **Email system**         | `enqueueBookingCreatedSideEffects` | `enqueueBookingCreatedSideEffects` | `enqueueBookingCreatedSideEffects` ✅ |
| **Email timing logic**   | 9 AM - 8 PM optimal                | 9 AM - 8 PM optimal                | 9 AM - 8 PM optimal ✅                |
| **Execution order**      | Auto-assign → Email                | ❌ Email → Auto-assign             | ✅ Auto-assign → Email                |
| **Correct email sent**   | ✅ Yes                             | ❌ No                              | ✅ Yes                                |

## Email Types Sent

Based on final booking status AFTER auto-assign:

| Final Status         | Email Type       | Content                                      |
| -------------------- | ---------------- | -------------------------------------------- |
| `pending`            | Request Received | "We've received your request..."             |
| `pending_allocation` | Request Received | "We've received your request..."             |
| `confirmed`          | Confirmation     | "Your booking is confirmed!" + table details |

## Email Optimal Timing (All Bookings)

Both public and ops bookings use the same smart scheduling:

| Email Type       | Timing              | Optimal Hours Applied |
| ---------------- | ------------------- | --------------------- |
| Request Received | Immediate           | No                    |
| Confirmation     | Immediate           | No                    |
| 24h Reminder     | 24h before booking  | **Yes** (9 AM - 8 PM) |
| 2h Reminder      | 2h before booking   | **Yes** (9 AM - 8 PM) |
| Review Request   | 3h after visit ends | **Yes** (9 AM - 8 PM) |

**Smart scheduling examples:**

- If 24h reminder would send at 2 AM → moves to 9 AM same day
- If review would send at 11 PM → delays to 10 AM next morning
- Always stays within 9 AM - 8 PM window for maximum open rates

## Testing Verification

To verify the fix works:

1. **Enable auto-assign feature flag** in `.env.local`:

   ```bash
   FEATURE_AUTO_ASSIGN_ON_BOOKING=true
   FEATURE_INLINE_AUTO_ASSIGN_TIMEOUT_MS=4000
   ```

2. **Create an ops walk-in booking** with available tables

3. **Expected logs**:

   ```
   [inline-auto-assign] start { bookingId: '...', ... }
   [inline-auto-assign] quote result { hasHold: true, ... }
   [inline-auto-assign] confirm completed { ... }
   [resend] Sending email to: ..., subject: "Booking Confirmed ✅ - ..."
   ```

4. **Expected email**: Customer receives **confirmation email**, not request email

## Summary

✅ **Fixed**: Ops bookings now send correct email type  
✅ **Verified**: Build passes successfully  
✅ **Result**: Ops and public bookings now have truly identical behavior for auto-assign + emails
