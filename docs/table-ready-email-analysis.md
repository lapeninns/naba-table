# Table Ready Email & "I'm Here" CTA Analysis

## Overview

Based on the codebase analysis, here's how the "Table Ready" email and "I'm Here" button currently work:

---

## Email Details

### **"Table Ready" Email (Short Reminder)**

**Trigger**: 2 hours before booking  
**Email Type**: `reminder` with `variant: 'short'`  
**File**: `server/emails/bookings.ts` (lines 623-626)

```typescript
if (options?.reminderVariant === 'short') {
  // Same day / Arrival
  baseHeadline = 'Table Ready 🍽️';
  baseIntro = `We've prepped your table at ${venue.name}. Please head to the host stand when you arrive.`;
  ctaLabel = "I'm Here";
}
```

---

## Current "I'm Here" Button Behavior

### **What It Does NOW:**

The "I'm Here" button in the email is currently a **passive link** that:

❌ **Does NOT trigger check-in automatically**  
✅ **Links to the booking management page** (where guest can view details)

**CTA URL**:

```typescript
ctaUrl = manageUrl; // Links to `/bookings/recover?access_token=...`
```

### **What Happens When Clicked:**

1. **Guest clicks "I'm Here"** in email
2. **Redirects to** `/bookings/recover` with access token
3. **Auto-authenticates** guest session
4. **Shows booking details page** (`/bookings/[id]`)
5. **Guest can manually** view booking details
6. ❌ **NO automatic check-in triggered**

---

## Check-In Functionality

### **Where Check-In Happens:**

Check-in is an **ops-facing action** performed by staff:

**API Endpoint**: `/api/ops/bookings/[id]/check-in`  
**Method**: `POST`  
**Access**: Staff only (requires ops authentication)  
**File**: `src/app/api/ops/bookings/[id]/check-in/route.ts`

### **Check-In Process:**

```typescript
// Staff clicks check-in button in ops dashboard
POST /api/ops/bookings/[bookingId]/check-in

// Updates booking status
status: 'confirmed' → 'checked_in'

// Records in booking history
action: 'checked_in'
performed_by: staff_user_id
```

---

## Current Limitation

### **Problem:**

| Action                  | Current Behavior          | Ideal Behavior        |
| ----------------------- | ------------------------- | --------------------- |
| Guest clicks "I'm Here" | ✅ Opens booking page     | ✅ Triggers check-in  |
| Check-in recorded       | ❌ No                     | ✅ Yes                |
| Staff notified          | ❌ No                     | ✅ Yes (optional)     |
| Status updated          | ❌ No (stays `confirmed`) | ✅ Yes (`checked_in`) |

**Current Flow:**

```
1. Guest receives "Table Ready" email
2. Guest clicks "I'm Here"
3. → Opens booking page
4. → Guest waits
5. Staff manually checks guest in
```

**Missing**: Self-service check-in via email link

---

## Proposed Enhancement

### **Option 1: Guest Self-Service Check-In** (Recommended)

**Create new endpoint**: `/api/bookings/[id]/check-in` (guest-facing)

```typescript
// When guest clicks "I'm Here" in email:
POST /api/bookings/[bookingId]/check-in
Authorization: session_recovery_token

// Updates booking:
status: 'confirmed' → 'checked_in'
metadata: { self_checked_in: true, checked_in_at: timestamp }

// Optional: Notify staff
- Show notification in ops dashboard
- "John Smith has arrived (Table 12)"
```

**Benefits:**

- ✅ Guest can self-check-in from email
- ✅ Reduces staff workload
- ✅ Better guest experience
- ✅ Real-time arrival tracking

---

### **Option 2: Intent Notification Only**

Keep current behavior but add notification:

```typescript
// When guest clicks "I'm Here":
POST / api / bookings / [id] / arrival - intent;

// Records intent without status change:
metadata: {
  arrival_intent_at: timestamp;
}

// Notifies staff in dashboard:
-"John Smith says 'I'm Here' - Please check in";
```

**Benefits:**

- ✅ Minimal changes
- ✅ Staff still controls check-in
- ✅ Better visibility of arriving guests

**Drawbacks:**

- ⚠️ Not true self-service
- ⚠️ Still requires staff action

---

### **Option 3: Hybrid Approach**

Guest action triggers check-in + staff verification:

```typescript
// When guest clicks "I'm Here":
1. Auto-check-in guest → status: 'arrived' (new status)
2. Notify staff → "John Smith checked in online"
3. Staff verifies → status: 'checked_in' (or 'seated')
```

**Benefits:**

- ✅ Guest sees immediate feedback
- ✅ Staff can verify before seating
- ✅ Audit trail of self vs manual check-in

---

## Implementation for Option 1 (Recommended)

### **1. Create Guest Check-In Endpoint**

**File**: `src/app/api/bookings/[id]/check-in/route.ts`

```typescript
import { type NextRequest } from 'next/server';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';
import { recordObservabilityEvent } from '@/server/observability';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await getRouteHandlerSupabaseClient();
  const bookingId = params.id;

  // Verify guest authentication (via booking recovery token)
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Load booking
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single();

  if (bookingError || !booking) {
    return Response.json({ error: 'Booking not found' }, { status: 404 });
  }

  // Only allow check-in for confirmed bookings
  if (booking.status !== 'confirmed') {
    return Response.json({ error: 'Booking must be confirmed to check in' }, { status: 400 });
  }

  // Update booking status to checked_in
  const { data: updated, error: updateError } = await supabase
    .from('bookings')
    .update({
      status: 'checked_in',
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId)
    .select()
    .single();

  if (updateError) {
    return Response.json({ error: 'Failed to check in' }, { status: 500 });
  }

  // Record history
  await supabase.from('booking_history').insert({
    booking_id: bookingId,
    action: 'checked_in',
    performed_by: null, // Guest self-check-in
    metadata: {
      source: 'guest_email_link',
      self_service: true,
    },
  });

  // Record observability event
  await recordObservabilityEvent({
    source: 'guest.check_in',
    eventType: 'booking.checked_in.self_service',
    context: {
      booking_id: bookingId,
      restaurant_id: booking.restaurant_id,
    },
  });

  return Response.json({ booking: updated });
}
```

---

### **2. Update Email CTA URL**

**File**: `server/emails/bookings.ts` (line 626)

```typescript
if (options?.reminderVariant === 'short') {
  baseHeadline = 'Table Ready 🍽️';
  baseIntro = `We've prepped your table at ${venue.name}. Please head to the host stand when you arrive.`;
  ctaLabel = "I'm Here";
  // NEW: Link to check-in endpoint instead of manage URL
  ctaUrl = `${manageUrl}&action=check-in`;
}
```

---

### **3. Update Booking Page to Handle Check-In Action**

**File**: `src/app/bookings/[id]/page.tsx`

```typescript
// Check for ?action=check-in in URL
const searchParams = useSearchParams();
const action = searchParams.get('action');

useEffect(() => {
  if (action === 'check-in' && booking?.status === 'confirmed') {
    // Trigger check-in API call
    handleCheckIn();
  }
}, [action, booking]);

const handleCheckIn = async () => {
  const response = await fetch(`/api/bookings/${booking.id}/check-in`, {
    method: 'POST',
  });

  if (response.ok) {
    toast.success('Checked in successfully! 🎉');
    // Refresh booking data
    mutate();
  }
};
```

---

## Summary

| Feature               | Current Status              | After Enhancement               |
| --------------------- | --------------------------- | ------------------------------- |
| **"I'm Here" Email**  | ✅ Sent 2h before           | ✅ Same                         |
| **"I'm Here" Button** | ❌ Just opens booking page  | ✅ **Triggers check-in**        |
| **Check-In Status**   | ❌ Manual (staff only)      | ✅ **Auto-updated**             |
| **Guest Experience**  | ⚠️ Passive                  | ✅ **Active self-service**      |
| **Staff Workload**    | ⚠️ Manual check-in required | ✅ **Reduced**                  |
| **Ops Dashboard**     | ✅ Manual check-in button   | ✅ Show "self-checked-in" badge |

---

## Recommendation

**Implement Option 1**: Guest self-service check-in via email link

**Why:**

1. ✅ Better guest experience (one-click check-in)
2. ✅ Reduces staff workload
3. ✅ Real-time arrival tracking
4. ✅ Aligns with modern hospitality expectations
5. ✅ Minimal frontend changes needed

**Effort**: Medium (1-2 days)  
**Impact**: High (significantly improves guest experience)

---

## Current Answer to Your Question

> **"Does the table ready email and I'm Here CTA act as check-in button?"**

**NO**, currently it does NOT:

- ❌ "I'm Here" button **does not trigger check-in**
- ✅ It only **opens the booking management page**
- ⚠️ Guest must wait for **staff to manually check them in**

**But it COULD** with the enhancement outlined above! 🚀
