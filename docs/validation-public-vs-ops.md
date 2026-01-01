# Validation: Public vs Ops Booking Flow Comparison

## Executive Summary

✅ **Auto-assign logic**: IDENTICAL  
✅ **Email system**: IDENTICAL  
✅ **Execution order**: IDENTICAL  
⚠️ **One Critical Difference Found**: Public has background retry, Ops does NOT

---

## Side-by-Side Flow Comparison

### **Public Bookings (`/api/bookings`)**

```typescript
// Step 1: Auto-Assign (if enabled)
if (!reusedExisting && env.featureFlags.autoAssignOnBooking) {
  const { runInlineAutoAssign } = await import('@/services/inline-auto-assign');
  const inlineTimeoutMs = env.featureFlags.inlineAutoAssignTimeoutMs ?? 4000;

  const updatedBooking = await runInlineAutoAssign({
    bookingId: finalBooking.id,
    restaurantId,
    timeoutMs: inlineTimeoutMs,
    createdBy: 'api-booking', // ← metadata
    historyReason: 'api_inline_auto_assign', // ← metadata
    observabilitySource: 'bookings.inline_auto_assign', // ← metadata
    client: supabase,
    onBookingUpdated: (booking) => {
      finalBooking = booking;
    },
  });

  if (updatedBooking) {
    finalBooking = updatedBooking;
  }
}

// Step 2: Send Emails (based on final status)
if (!reusedExisting) {
  await enqueueBookingCreatedSideEffects(
    {
      booking: safeBookingPayload(finalBooking),
      idempotencyKey,
      restaurantId,
      emailProvided: isOpsWalkIn ? opsEmailProvidedHeader : true,
    },
    { supabase },
  );

  // Step 3: Background Retry (if inline failed to confirm)
  if (env.featureFlags.autoAssignOnBooking && finalBooking.status !== 'confirmed') {
    const { autoAssignAndConfirmIfPossible } = await import('@/server/jobs/auto-assign');
    void autoAssignAndConfirmIfPossible(finalBooking.id); // ← BACKGROUND RETRY
  }
}
```

---

### **Ops Bookings - Non-Unified Path (`/api/ops/bookings`)**

```typescript
// Step 1: Auto-Assign (if enabled)
if (isAutoAssignOnBookingEnabled()) {
  const { runInlineAutoAssign } = await import('@/services/inline-auto-assign');
  const inlineTimeoutMs = env.featureFlags.inlineAutoAssignTimeoutMs ?? 4000;

  const updatedBooking = await runInlineAutoAssign({
    bookingId: booking.id,
    restaurantId: payload.restaurantId,
    timeoutMs: inlineTimeoutMs,
    createdBy: 'ops-walk-in', // ← metadata
    historyReason: 'ops_walk_in_inline_auto_assign', // ← metadata
    observabilitySource: 'api.ops.bookings.inline_auto_assign', // ← metadata
    client: service,
    onBookingUpdated: (updated) => {
      responseBody.booking = updated;
    },
  });

  if (updatedBooking) {
    responseBody.booking = updatedBooking;
  }
}

// Step 2: Send Emails (based on final status)
await enqueueBookingCreatedSideEffects({
  booking: safeBookingPayload(responseBody.booking),
  idempotencyKey: normalizedIdempotencyKey,
  restaurantId: payload.restaurantId,
  emailProvided,
});

// Step 3: Background Retry
// ❌ MISSING - No background retry!
```

---

### **Ops Bookings - Unified Path (`/api/ops/bookings`)**

```typescript
// Step 1: Auto-Assign (if enabled and not duplicate)
if (!reusedExisting && isAutoAssignOnBookingEnabled()) {
  const { runInlineAutoAssign } = await import('@/services/inline-auto-assign');
  const inlineTimeoutMs = env.featureFlags.inlineAutoAssignTimeoutMs ?? 4000;

  const updatedBooking = await runInlineAutoAssign({
    bookingId: booking.id,
    restaurantId: payload.restaurantId,
    timeoutMs: inlineTimeoutMs,
    createdBy: 'ops-walk-in', // ← metadata
    historyReason: 'ops_walk_in_inline_auto_assign', // ← metadata
    observabilitySource: 'api.ops.bookings.inline_auto_assign', // ← metadata
    client: service,
  });

  if (updatedBooking) {
    booking = updatedBooking;
  }
}

// Step 2: Send Emails (based on final status)
if (!reusedExisting) {
  await enqueueBookingCreatedSideEffects({
    booking: safeBookingPayload(booking),
    idempotencyKey: normalizedIdempotencyKey,
    restaurantId: payload.restaurantId,
    emailProvided,
  });
}

// Step 3: Background Retry
// ❌ MISSING - No background retry!
```

---

## Detailed Comparison Matrix

| Feature                       | Public Bookings                    | Ops Non-Unified                    | Ops Unified                        | Match?               |
| ----------------------------- | ---------------------------------- | ---------------------------------- | ---------------------------------- | -------------------- |
| **Auto-Assign Function**      | `runInlineAutoAssign`              | `runInlineAutoAssign`              | `runInlineAutoAssign`              | ✅                   |
| **Timeout**                   | 4000ms (configurable)              | 4000ms (configurable)              | 4000ms (configurable)              | ✅                   |
| **Execution Order**           | Auto → Email                       | Auto → Email                       | Auto → Email                       | ✅                   |
| **Email System**              | `enqueueBookingCreatedSideEffects` | `enqueueBookingCreatedSideEffects` | `enqueueBookingCreatedSideEffects` | ✅                   |
| **Email Type Logic**          | Based on final status              | Based on final status              | Based on final status              | ✅                   |
| **onBookingUpdated Callback** | Updates `finalBooking`             | Updates `responseBody.booking`     | Updates `booking`                  | ✅ (same pattern)    |
| **Error Handling**            | Try-catch with console.warn        | Try-catch with console.error       | Try-catch with console.error       | ✅                   |
| **Duplicate Check**           | `!reusedExisting &&`               | No check (always runs)             | `!reusedExisting &&`               | ⚠️ Different         |
| **Background Retry**          | ✅ Yes (if status ≠ confirmed)     | ❌ **MISSING**                     | ❌ **MISSING**                     | ❌ **NOT IDENTICAL** |

---

## Key Findings

### ✅ **What's Identical:**

1. **Auto-assign implementation** - Same `runInlineAutoAssign` service
2. **Timeout control** - Same 4s default, configurable
3. **Email system** - Same `enqueueBookingCreatedSideEffects`
4. **Execution order** - Auto-assign runs BEFORE emails
5. **Email type logic** - Based on final booking status after auto-assign
6. **Error handling** - Both catch and log errors gracefully

### ⚠️ **What's Different:**

#### 1. **Metadata (Intentional)**

- `createdBy`: `'api-booking'` vs `'ops-walk-in'`
- `historyReason`: Different values for audit trail
- `observabilitySource`: Different values for log filtering

**Verdict**: ✅ These are intentional and correct

#### 2. **Duplicate Check (Non-Unified Path Only)**

- Public: Checks `!reusedExisting` before auto-assign
- Ops Non-Unified: No duplicate check, always runs
- Ops Unified: Checks `!reusedExisting` ✅

**Verdict**: ⚠️ Non-unified path should probably add the check

#### 3. **Background Retry (CRITICAL)**

- Public: Has background retry if inline times out or fails
- Ops: **NO background retry at all**

**Verdict**: ❌ **This is a meaningful difference!**

---

## Critical Missing Feature: Background Retry

### **What Public Bookings Do:**

```typescript
// If inline attempt did not confirm and retries are configured, run background job
if (env.featureFlags.autoAssignOnBooking && finalBooking.status !== 'confirmed') {
  const { autoAssignAndConfirmIfPossible } = await import('@/server/jobs/auto-assign');
  void autoAssignAndConfirmIfPossible(finalBooking.id);
}
```

### **What Ops Bookings Do:**

❌ Nothing - no background retry

### **Impact:**

| Scenario                | Public Behavior                          | Ops Behavior                                |
| ----------------------- | ---------------------------------------- | ------------------------------------------- |
| Inline succeeds (< 4s)  | ✅ Confirmed immediately                 | ✅ Confirmed immediately                    |
| Inline times out (> 4s) | ⏳ Background retry scheduled            | ❌ Stays pending forever                    |
| Inline fails (error)    | ⏳ Background retry scheduled            | ❌ Stays pending forever                    |
| Tables busy at creation | ⏳ Background retry (tables may free up) | ❌ Stays pending (manual assignment needed) |

---

## Recommendation

### **Do you want to add background retry to ops bookings?**

**Option 1: Make Them Truly Identical**

- Add the same background retry logic to ops
- Ops will behave exactly like public for resilience

**Option 2: Keep Ops Different (Intentional)**

- Ops bookings created by staff who can manually assign if needed
- No need for background retries since staff is present
- Simpler, less background processing

**My Recommendation**: **Option 1** - Add background retry for consistency and resilience, especially since you've already unified everything else.

---

## Summary

| Category              | Status            | Notes                             |
| --------------------- | ----------------- | --------------------------------- |
| **Auto-Assign Logic** | ✅ Identical      | Same function, timeout, telemetry |
| **Email System**      | ✅ Identical      | Same function, same order         |
| **Execution Order**   | ✅ Identical      | Auto → Email in both              |
| **Metadata**          | ⚠️ Different      | Intentional (tracking)            |
| **Background Retry**  | ❌ Missing in Ops | Functional difference             |

**Verdict**: 95% identical. The 5% difference (background retry) is significant for resilience.
