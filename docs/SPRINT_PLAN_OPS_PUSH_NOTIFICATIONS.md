# Sprint Plan: Push Notifications for Restaurant Operators (Ops Dashboard)

**Sprint Duration:** 2 weeks (10 business days)  
**Team Size:** 3-4 developers (Backend, Frontend, Full-stack, QA)  
**Target Users:** Restaurant Staff/Owners/Managers (B2B)  
**Created:** 2025-01-14  
**Status:** Ready for Review

---

## Executive Summary

Implement **real-time push notifications for restaurant operators** in the ops dashboard to receive instant alerts about:

- New bookings
- Booking changes/cancellations
- VIP guest arrivals
- Capacity alerts
- No-show events

**Key Distinction:** This is a **B2B notification system** for restaurant management, not guest-facing. All notifications route to staff members based on their restaurant memberships and roles.

---

## Sprint Goals

### Primary Goals

1. **Multi-Restaurant Push Notification System**
   - Staff can subscribe to notifications for each restaurant they manage
   - Support for users managing multiple restaurants
   - Device tokens scoped to `(user_id, restaurant_id, device)`

2. **Real-Time Operational Alerts**
   - New booking → Notify all active staff members
   - Booking updated → Notify relevant staff based on role
   - Booking cancelled → Immediate alert to floor managers
   - VIP arrival (30min before) → Alert front-of-house staff
   - Capacity >90% → Alert managers
   - No-show marked → Alert hosts

3. **Role-Based Notification Preferences**
   - **Owner/Admin:** All notifications (business oversight)
   - **Manager:** Operational alerts (bookings, capacity, VIPs)
   - **Host/Staff:** Floor-level alerts (arrivals, cancellations)
   - **Viewer:** Optional notifications (read-only access)

4. **Business-Aware Delivery**
   - Quiet hours configuration per restaurant (e.g., mute 11pm-7am)
   - Urgent vs. non-urgent priority levels
   - "Do Not Disturb" mode for individual users
   - Notification history in ops dashboard

### Success Criteria

- ✅ 95%+ delivery rate within 5 seconds (business-critical SLA)
- ✅ Support for staff managing 1-10 restaurants simultaneously
- ✅ Works on Chrome, Firefox, Edge (primary ops devices)
- ✅ Zero false notifications (high signal-to-noise ratio)
- ✅ Notification center UI in ops dashboard
- ✅ One-click opt-in flow for ops users
- ✅ Graceful degradation if FCM unavailable

---

## Repository Analysis

### Existing Ops Infrastructure

#### Database Schema (Leverage These)

```sql
-- restaurant_memberships: Staff-to-restaurant association
CREATE TABLE restaurant_memberships (
  user_id uuid NOT NULL REFERENCES auth.users(id),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id),
  role text NOT NULL,  -- owner, admin, staff, viewer
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, restaurant_id)
);

-- Helper function: Get user's restaurants
CREATE FUNCTION user_restaurants() RETURNS SETOF uuid AS $$
  SELECT restaurant_id FROM restaurant_memberships
  WHERE user_id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- bookings: Source of notification events
CREATE TABLE bookings (
  id uuid PRIMARY KEY,
  restaurant_id uuid NOT NULL,  -- ← Key for routing to staff
  customer_name text NOT NULL,
  party_size integer NOT NULL,
  booking_date date NOT NULL,
  start_time time NOT NULL,
  status booking_status NOT NULL,
  reference text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);
```

#### Backend Services

```
server/
├── jobs/booking-side-effects.ts     # ← EXTEND: Add ops push notifications
├── ops/
│   ├── bookings.ts                  # Ops booking queries
│   ├── capacity.ts                  # Capacity calculations
│   └── vips.ts                      # VIP tracking
├── auth/guards.ts                   # requireRestaurantMember()
└── team/access.ts                   # fetchUserMemberships()
```

#### Frontend (Ops Dashboard)

```
src/app/(ops)/ops/
├── (app)/page.tsx                              # Main ops dashboard
├── (app)/bookings/page.tsx                     # Bookings management
└── layout.tsx                                  # Ops shell (add notification bell here)

src/components/features/
├── dashboard/
│   ├── OpsDashboardClient.tsx                  # Main dashboard component
│   ├── BookingChangeFeed.tsx                   # Real-time feed (add push integration)
│   └── VIPGuestsModule.tsx                     # VIP tracking (add alerts)
└── ops-shell/
    └── navigation.tsx                          # Nav menu (add notification center link)
```

---

## Technical Architecture

### High-Level Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                      Booking Event Occurs                         │
│  (New booking created via /api/ops/bookings or /api/bookings)    │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                  Inngest: booking.created.side-effects           │
│  1. Send guest confirmation email                                │
│  2. Record analytics event                                        │
│  3. NEW: Send ops push notifications ─────────────────────┐      │
└───────────────────────────────────────────────────────────┼──────┘
                                                            │
                                                            ▼
┌──────────────────────────────────────────────────────────────────┐
│         sendOpsBookingNotification(booking, restaurant_id)       │
│                                                                   │
│  1. Query restaurant_memberships WHERE restaurant_id             │
│     ├─> owner_user_id                                            │
│     ├─> admin_user_id_1                                          │
│     ├─> staff_user_id_2                                          │
│     └─> staff_user_id_3                                          │
│                                                                   │
│  2. For each staff member:                                       │
│     Query ops_push_subscriptions WHERE:                          │
│       - user_id = staff_user_id                                  │
│       - restaurant_id = booking.restaurant_id                    │
│       - is_active = true                                         │
│                                                                   │
│  3. Filter by preferences:                                       │
│     - Check if user enabled "new_booking" notifications         │
│     - Check quiet hours (is current time in mute window?)       │
│     - Check user's DND status                                    │
│                                                                   │
│  4. Send via FCM:                                                │
│     admin.messaging().sendEachForMulticast({                     │
│       tokens: [fcm_token_1, fcm_token_2, ...],                  │
│       notification: {                                            │
│         title: "New Booking at Bella Trattoria",                │
│         body: "Party of 4 at 7:00 PM - Table for Martinez"     │
│       },                                                         │
│       data: {                                                    │
│         type: "booking.created",                                │
│         booking_id, restaurant_id, reference                    │
│       },                                                         │
│       android: { priority: "high" },                            │
│       webpush: { urgency: "high" }                              │
│     })                                                           │
│                                                                   │
│  5. Log each attempt to ops_notification_logs                   │
└──────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│              FCM → Service Worker → Staff Devices                │
│                                                                   │
│  /ops-sw.js receives push event:                                │
│  self.addEventListener('push', (event) => {                      │
│    const { title, body, data } = event.data.json();             │
│    self.registration.showNotification(title, {                  │
│      body,                                                       │
│      icon: '/images/ops-logo-192.png',                          │
│      badge: '/images/badge-72.png',                             │
│      tag: data.booking_id,  // Collapse duplicates             │
│      requireInteraction: true,  // Stay until clicked           │
│      actions: [                                                  │
│        { action: 'view', title: 'View Booking' },              │
│        { action: 'dismiss', title: 'Dismiss' }                  │
│      ],                                                          │
│      data: { url: `/ops/bookings?id=${data.booking_id}` }     │
│    });                                                           │
│  });                                                             │
│                                                                   │
│  User clicks notification → Opens ops dashboard at booking      │
└──────────────────────────────────────────────────────────────────┘
```

### Database Schema (New Tables)

#### 1. `ops_push_subscriptions`

```sql
-- Stores push notification subscriptions for ops users
-- One subscription per (user, restaurant, device) tuple
CREATE TABLE IF NOT EXISTS public.ops_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  fcm_token text NOT NULL,
  endpoint text NOT NULL,
  auth_key text NOT NULL,
  p256dh_key text NOT NULL,
  user_agent text,

  -- Notification preferences per event type
  preferences jsonb NOT NULL DEFAULT '{
    "booking_created": true,
    "booking_updated": true,
    "booking_cancelled": true,
    "vip_arrival": true,
    "capacity_alert": true,
    "no_show_alert": true
  }'::jsonb,

  -- Quiet hours configuration (times in restaurant timezone)
  quiet_hours jsonb DEFAULT '{
    "enabled": false,
    "start_time": "23:00",
    "end_time": "07:00"
  }'::jsonb,

  is_active boolean NOT NULL DEFAULT true,
  do_not_disturb boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,

  -- Unique constraint: one subscription per user/restaurant/device
  UNIQUE(user_id, restaurant_id, fcm_token)
);

-- Indexes for fast lookups
CREATE INDEX idx_ops_push_subscriptions_user ON public.ops_push_subscriptions(user_id) WHERE is_active = true;
CREATE INDEX idx_ops_push_subscriptions_restaurant ON public.ops_push_subscriptions(restaurant_id) WHERE is_active = true;
CREATE INDEX idx_ops_push_subscriptions_user_restaurant ON public.ops_push_subscriptions(user_id, restaurant_id) WHERE is_active = true;
CREATE INDEX idx_ops_push_subscriptions_token ON public.ops_push_subscriptions(fcm_token) WHERE is_active = true;

-- RLS Policies
ALTER TABLE public.ops_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own subscriptions for restaurants they're members of
CREATE POLICY "Users can view own subscriptions"
  ON public.ops_push_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id AND restaurant_id IN (SELECT user_restaurants()));

CREATE POLICY "Users can insert own subscriptions for their restaurants"
  ON public.ops_push_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND restaurant_id IN (SELECT user_restaurants()));

CREATE POLICY "Users can update own subscriptions"
  ON public.ops_push_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id AND restaurant_id IN (SELECT user_restaurants()))
  WITH CHECK (auth.uid() = user_id AND restaurant_id IN (SELECT user_restaurants()));

CREATE POLICY "Users can delete own subscriptions"
  ON public.ops_push_subscriptions
  FOR DELETE
  USING (auth.uid() = user_id AND restaurant_id IN (SELECT user_restaurants()));

-- Service role can manage all subscriptions (for background jobs)
CREATE POLICY "Service role can manage all ops subscriptions"
  ON public.ops_push_subscriptions
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Auto-update timestamp trigger
CREATE TRIGGER ops_push_subscriptions_updated_at
  BEFORE UPDATE ON public.ops_push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.ops_push_subscriptions IS 'Push notification subscriptions for ops dashboard users';
COMMENT ON COLUMN public.ops_push_subscriptions.restaurant_id IS 'Restaurant this subscription is for (users can have multiple)';
COMMENT ON COLUMN public.ops_push_subscriptions.preferences IS 'Per-event-type notification preferences';
COMMENT ON COLUMN public.ops_push_subscriptions.quiet_hours IS 'Mute notifications during specified hours';
COMMENT ON COLUMN public.ops_push_subscriptions.do_not_disturb IS 'Global mute for this subscription';
```

#### 2. `ops_notification_logs`

```sql
-- Audit log for ops push notification deliveries
CREATE TYPE public.ops_notification_type AS ENUM (
  'booking.created',
  'booking.updated',
  'booking.cancelled',
  'vip.arrival',
  'capacity.alert',
  'no_show.alert'
);

CREATE TYPE public.notification_status AS ENUM (
  'pending',
  'sent',
  'delivered',
  'failed',
  'skipped'
);

CREATE TABLE IF NOT EXISTS public.ops_notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.ops_push_subscriptions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,

  notification_type public.ops_notification_type NOT NULL,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,

  notification_payload jsonb NOT NULL,  -- title, body, icon, data
  status public.notification_status NOT NULL DEFAULT 'pending',

  fcm_response jsonb,  -- Response from FCM API
  error_message text,
  skip_reason text,  -- "quiet_hours", "dnd", "preference_disabled"

  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_ops_notification_logs_subscription ON public.ops_notification_logs(subscription_id);
CREATE INDEX idx_ops_notification_logs_user ON public.ops_notification_logs(user_id);
CREATE INDEX idx_ops_notification_logs_restaurant ON public.ops_notification_logs(restaurant_id);
CREATE INDEX idx_ops_notification_logs_booking ON public.ops_notification_logs(booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX idx_ops_notification_logs_created_at ON public.ops_notification_logs(created_at DESC);
CREATE INDEX idx_ops_notification_logs_status ON public.ops_notification_logs(status, created_at DESC);
CREATE INDEX idx_ops_notification_logs_type ON public.ops_notification_logs(notification_type, created_at DESC);

-- RLS: Users can view logs for their restaurants
ALTER TABLE public.ops_notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification logs"
  ON public.ops_notification_logs
  FOR SELECT
  USING (auth.uid() = user_id AND restaurant_id IN (SELECT user_restaurants()));

CREATE POLICY "Service role can manage all logs"
  ON public.ops_notification_logs
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.ops_notification_logs IS 'Audit log for ops push notification delivery attempts';
```

---

## Implementation Plan

### Week 1: Backend & Infrastructure

#### Day 1: Firebase Setup & Database Migrations (Backend Lead)

**Tasks:**

1. Create Firebase project `sajiloreservex-ops-prod`
2. Enable FCM and generate VAPID keys
3. Download service account JSON
4. Add environment variables to Vercel
5. Install `firebase-admin` SDK
6. Write migration: `ops_push_subscriptions.sql`
7. Write migration: `ops_notification_logs.sql`
8. Deploy migrations to staging: `supabase db push`
9. Update TypeScript types: `types/supabase.ts`

**Story Points:** 3  
**Estimated Hours:** 6 hours

---

#### Day 2-3: Push Notification Sender Service (Backend Lead)

**File:** `server/ops/push/send.ts`

**Implementation:**

```typescript
// server/ops/push/send.ts
import * as admin from 'firebase-admin';
import { getServiceSupabaseClient } from '@/server/supabase';
import type { Tables } from '@/types/supabase';

// Initialize Firebase Admin SDK (singleton)
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON!);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

export type OpsNotificationType =
  | 'booking.created'
  | 'booking.updated'
  | 'booking.cancelled'
  | 'vip.arrival'
  | 'capacity.alert'
  | 'no_show.alert';

export type OpsNotificationPayload = {
  restaurantId: string;
  type: OpsNotificationType;
  title: string;
  body: string;
  icon?: string;
  url?: string;
  data?: Record<string, string>;
  bookingId?: string;
  priority?: 'high' | 'normal';
};

/**
 * Send push notification to all subscribed staff members of a restaurant
 */
export async function sendOpsNotification(payload: OpsNotificationPayload) {
  const supabase = getServiceSupabaseClient();
  const {
    restaurantId,
    type,
    title,
    body,
    icon,
    url,
    data,
    bookingId,
    priority = 'high',
  } = payload;

  // 1. Get all staff members of this restaurant
  const { data: memberships, error: memberError } = await supabase
    .from('restaurant_memberships')
    .select('user_id, role')
    .eq('restaurant_id', restaurantId);

  if (memberError || !memberships?.length) {
    console.log(`[ops-push] No staff found for restaurant ${restaurantId}`);
    return { success: 0, failed: 0, skipped: 0 };
  }

  const userIds = memberships.map((m) => m.user_id);

  // 2. Get active subscriptions for these users for this restaurant
  const { data: subscriptions, error: subError } = await supabase
    .from('ops_push_subscriptions')
    .select('id, user_id, fcm_token, preferences, quiet_hours, do_not_disturb')
    .eq('restaurant_id', restaurantId)
    .in('user_id', userIds)
    .eq('is_active', true);

  if (subError || !subscriptions?.length) {
    console.log(`[ops-push] No active subscriptions for restaurant ${restaurantId}`);
    return { success: 0, failed: 0, skipped: 0 };
  }

  // 3. Filter by preferences and quiet hours
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

  const eligible = subscriptions.filter((sub) => {
    // Check DND
    if (sub.do_not_disturb) {
      logSkipped(sub.id, type, bookingId, restaurantId, sub.user_id, 'dnd');
      return false;
    }

    // Check event type preference
    const prefs = sub.preferences as Record<string, boolean>;
    const prefKey = type.replace('.', '_');
    if (prefs[prefKey] === false) {
      logSkipped(sub.id, type, bookingId, restaurantId, sub.user_id, 'preference_disabled');
      return false;
    }

    // Check quiet hours (only for non-urgent notifications)
    if (priority !== 'high' && sub.quiet_hours) {
      const qh = sub.quiet_hours as { enabled: boolean; start_time: string; end_time: string };
      if (qh.enabled && isInQuietHours(currentTimeStr, qh.start_time, qh.end_time)) {
        logSkipped(sub.id, type, bookingId, restaurantId, sub.user_id, 'quiet_hours');
        return false;
      }
    }

    return true;
  });

  if (!eligible.length) {
    console.log(`[ops-push] All subscriptions filtered out for restaurant ${restaurantId}`);
    return { success: 0, failed: 0, skipped: subscriptions.length };
  }

  // 4. Prepare FCM message
  const message: admin.messaging.MulticastMessage = {
    tokens: eligible.map((s) => s.fcm_token),
    notification: { title, body },
    data: {
      ...data,
      type,
      restaurantId,
      bookingId: bookingId || '',
      url: url || '/ops',
    },
    android: {
      priority: priority === 'high' ? 'high' : 'normal',
    },
    webpush: {
      notification: {
        icon: icon || '/images/ops-logo-192.png',
        badge: '/images/badge-72.png',
        tag: bookingId || `ops-${type}-${Date.now()}`,
        requireInteraction: priority === 'high',
        actions: [
          { action: 'view', title: 'View' },
          { action: 'dismiss', title: 'Dismiss' },
        ],
      },
      fcmOptions: {
        link: url || '/ops',
      },
      headers: {
        Urgency: priority === 'high' ? 'high' : 'normal',
      },
    },
  };

  // 5. Send via FCM
  let response: admin.messaging.BatchResponse;
  try {
    response = await admin.messaging().sendEachForMulticast(message);
  } catch (error) {
    console.error('[ops-push] FCM send failed', error);

    // Log all as failed
    await Promise.allSettled(
      eligible.map((sub) =>
        logFailed(sub.id, type, payload, bookingId, restaurantId, sub.user_id, String(error)),
      ),
    );

    return { success: 0, failed: eligible.length, skipped: subscriptions.length - eligible.length };
  }

  // 6. Process results
  let successCount = 0;
  let failedCount = 0;

  await Promise.allSettled(
    response.responses.map(async (result, index) => {
      const subscription = eligible[index];

      if (result.success) {
        successCount++;
        await logSuccess(
          subscription.id,
          type,
          payload,
          bookingId,
          restaurantId,
          subscription.user_id,
          result.messageId,
        );

        // Update last_used_at
        await supabase
          .from('ops_push_subscriptions')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', subscription.id);
      } else {
        failedCount++;
        const errorCode = result.error?.code;
        const errorMessage = result.error?.message || 'Unknown error';

        // Mark subscription inactive if token is invalid
        if (
          errorCode === 'messaging/invalid-registration-token' ||
          errorCode === 'messaging/registration-token-not-registered'
        ) {
          await supabase
            .from('ops_push_subscriptions')
            .update({ is_active: false })
            .eq('id', subscription.id);
        }

        await logFailed(
          subscription.id,
          type,
          payload,
          bookingId,
          restaurantId,
          subscription.user_id,
          `${errorCode}: ${errorMessage}`,
        );
      }
    }),
  );

  console.log(
    `[ops-push] Restaurant ${restaurantId}: ${successCount} sent, ${failedCount} failed, ${subscriptions.length - eligible.length} skipped`,
  );
  return {
    success: successCount,
    failed: failedCount,
    skipped: subscriptions.length - eligible.length,
  };
}

// Helper functions
function isInQuietHours(current: string, start: string, end: string): boolean {
  if (start < end) {
    return current >= start && current <= end;
  } else {
    // Quiet hours cross midnight
    return current >= start || current <= end;
  }
}

async function logSuccess(
  subId: string,
  type: OpsNotificationType,
  payload: OpsNotificationPayload,
  bookingId: string | undefined,
  restaurantId: string,
  userId: string,
  messageId: string,
) {
  const supabase = getServiceSupabaseClient();
  await supabase.from('ops_notification_logs').insert({
    subscription_id: subId,
    user_id: userId,
    restaurant_id: restaurantId,
    notification_type: type,
    booking_id: bookingId,
    notification_payload: {
      title: payload.title,
      body: payload.body,
      icon: payload.icon,
      url: payload.url,
      data: payload.data,
    },
    status: 'sent',
    fcm_response: { messageId },
    sent_at: new Date().toISOString(),
  });
}

async function logFailed(
  subId: string,
  type: OpsNotificationType,
  payload: OpsNotificationPayload,
  bookingId: string | undefined,
  restaurantId: string,
  userId: string,
  error: string,
) {
  const supabase = getServiceSupabaseClient();
  await supabase.from('ops_notification_logs').insert({
    subscription_id: subId,
    user_id: userId,
    restaurant_id: restaurantId,
    notification_type: type,
    booking_id: bookingId,
    notification_payload: {
      title: payload.title,
      body: payload.body,
      icon: payload.icon,
      url: payload.url,
      data: payload.data,
    },
    status: 'failed',
    error_message: error,
  });
}

async function logSkipped(
  subId: string,
  type: OpsNotificationType,
  bookingId: string | undefined,
  restaurantId: string,
  userId: string,
  reason: string,
) {
  const supabase = getServiceSupabaseClient();
  await supabase.from('ops_notification_logs').insert({
    subscription_id: subId,
    user_id: userId,
    restaurant_id: restaurantId,
    notification_type: type,
    booking_id: bookingId,
    notification_payload: {},
    status: 'skipped',
    skip_reason: reason,
  });
}
```

**Tests:** `server/ops/push/__tests__/send.test.ts` (mock FCM SDK, test filtering logic)

**Story Points:** 5  
**Estimated Hours:** 10 hours

---

#### Day 4: Integrate with Booking Events (Backend Lead)

**Extend:** `server/jobs/booking-side-effects.ts`

```typescript
// Add to processBookingCreatedSideEffects()
import { sendOpsNotification } from '@/server/ops/push/send';

async function processBookingCreatedSideEffects(payload: BookingCreatedSideEffectsPayload) {
  const { booking, restaurantId } = payload;

  // ... existing analytics + email logic ...

  // NEW: Notify restaurant staff
  try {
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('name')
      .eq('id', restaurantId)
      .single();

    const restaurantName = restaurant?.name || 'Restaurant';
    const date = formatReservationDateShort(booking.booking_date);
    const time = formatReservationTime(booking.start_time);

    await sendOpsNotification({
      restaurantId,
      type: 'booking.created',
      title: `New Booking at ${restaurantName}`,
      body: `${booking.customer_name} • Party of ${booking.party_size} • ${date} at ${time}`,
      icon: '/images/ops-icon-booking-new.png',
      url: `/ops?date=${booking.booking_date}&highlight=${booking.id}`,
      data: {
        bookingId: booking.id,
        reference: booking.reference,
        customerName: booking.customer_name,
        partySize: String(booking.party_size),
      },
      bookingId: booking.id,
      priority: 'high', // New bookings are urgent
    });
  } catch (error) {
    console.error('[jobs][booking.created][ops-push]', error);
    // Don't throw - push is supplementary
  }
}
```

**Similar integrations for:**

- `processBookingUpdatedSideEffects()` → `booking.updated`
- `processBookingCancelledSideEffects()` → `booking.cancelled`

**Story Points:** 3  
**Estimated Hours:** 6 hours

---

### Week 2: Frontend & Testing

#### Day 6: Service Worker (Frontend Lead)

**File:** `public/ops-sw.js`

```javascript
// public/ops-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: '...',
  projectId: 'sajiloreservex-ops-prod',
  messagingSenderId: '...',
  appId: '...',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[ops-sw] Background message received', payload);

  const { title, body, icon, data } = payload.notification || {};

  return self.registration.showNotification(title, {
    body,
    icon: icon || '/images/ops-logo-192.png',
    badge: '/images/badge-72.png',
    tag: data?.bookingId || `ops-${Date.now()}`,
    requireInteraction: data?.priority === 'high',
    data: { url: data?.url || '/ops' },
    actions: [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    vibrate: [200, 100, 200], // Ops notifications can vibrate
    silent: false,
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view' || !event.action) {
    const url = event.notification.data?.url || '/ops';
    event.waitUntil(clients.openWindow(url));
  }
});

// Register in ops dashboard layout
// src/app/(ops)/ops/layout.tsx
useEffect(() => {
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    navigator.serviceWorker
      .register('/ops-sw.js', { scope: '/ops/' })
      .then((reg) => console.log('[ops-sw] Registered:', reg.scope))
      .catch((err) => console.error('[ops-sw] Registration failed:', err));
  }
}, []);
```

**Story Points:** 3  
**Estimated Hours:** 6 hours

---

#### Day 7-8: Opt-In UI & Notification Center (Frontend Lead + Full-stack)

**1. Notification Bell Component**

**File:** `src/components/features/ops-push/OpsNotificationBell.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { OpsNotificationCenter } from './OpsNotificationCenter';

export function OpsNotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    // Check if user has subscribed
    checkSubscriptionStatus();

    // Poll for unread count (or use WebSocket in production)
    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 30000); // Every 30s

    return () => clearInterval(interval);
  }, []);

  async function checkSubscriptionStatus() {
    const response = await fetch('/api/ops/push/subscriptions');
    const data = await response.json();
    setIsSubscribed(data.subscriptions?.length > 0);
  }

  async function fetchUnreadCount() {
    // TODO: Implement /api/ops/notifications/unread endpoint
    // For now, always show 0
    setUnreadCount(0);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <OpsNotificationCenter isSubscribed={isSubscribed} onSubscribe={() => setIsSubscribed(true)} />
      </PopoverContent>
    </Popover>
  );
}
```

**2. Notification Center**

**File:** `src/components/features/ops-push/OpsNotificationCenter.tsx`

```typescript
'use client';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, BellOff, Settings } from 'lucide-react';
import { getMessaging, getToken } from 'firebase/messaging';
import { firebaseApp } from '@/lib/firebase/config';
import { useOpsActiveMembership } from '@/contexts/ops-services';

export function OpsNotificationCenter({ isSubscribed, onSubscribe }: { isSubscribed: boolean; onSubscribe: () => void }) {
  const membership = useOpsActiveMembership();
  const restaurantId = membership?.restaurantId;

  async function handleEnable() {
    if (!restaurantId) {
      alert('Please select a restaurant first');
      return;
    }

    try {
      // 1. Request browser permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Notification permission denied');
        return;
      }

      // 2. Get FCM token
      const messaging = getMessaging(firebaseApp);
      const token = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
      });

      if (!token) {
        throw new Error('Failed to retrieve FCM token');
      }

      // 3. Subscribe via API
      const response = await fetch('/api/ops/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId,
          token,
          endpoint: '',
          keys: { auth: '', p256dh: '' },
          preferences: {
            booking_created: true,
            booking_updated: true,
            booking_cancelled: true,
            vip_arrival: true,
            capacity_alert: true,
            no_show_alert: true
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save subscription');
      }

      onSubscribe();
      alert('Push notifications enabled!');
    } catch (error) {
      console.error('[ops-push] Enable failed', error);
      alert('Failed to enable notifications');
    }
  }

  if (!isSubscribed) {
    return (
      <div className="p-6 text-center">
        <Bell className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold mb-2">Enable Push Notifications</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Get instant alerts for new bookings, cancellations, and VIP arrivals
        </p>
        <Button onClick={handleEnable}>Enable Notifications</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[400px]">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">Notifications</h3>
        <Button variant="ghost" size="icon" asChild>
          <a href="/ops/notifications">
            <Settings className="h-4 w-4" />
          </a>
        </Button>
      </div>

      <Tabs defaultValue="all" className="flex-1">
        <TabsList className="w-full justify-start border-b rounded-none">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="vips">VIPs</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="p-4">
          <p className="text-sm text-muted-foreground text-center py-8">
            No notifications yet
          </p>
        </TabsContent>

        <TabsContent value="bookings" className="p-4">
          <p className="text-sm text-muted-foreground text-center py-8">
            No booking notifications
          </p>
        </TabsContent>

        <TabsContent value="vips" className="p-4">
          <p className="text-sm text-muted-foreground text-center py-8">
            No VIP notifications
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**3. Add to Ops Navigation**

**Edit:** `src/components/features/ops-shell/navigation.tsx`

```typescript
import { OpsNotificationBell } from '@/components/features/ops-push/OpsNotificationBell';

// Add to header
<div className="flex items-center gap-2">
  <OpsNotificationBell />
  {/* existing user menu */}
</div>
```

**Story Points:** 5  
**Estimated Hours:** 10 hours

---

#### Day 9: Testing & Bug Fixes (QA + All)

**Unit Tests:**

- `server/ops/push/__tests__/send.test.ts` - Mock FCM SDK, test multi-recipient logic
- `src/app/api/ops/push/__tests__/subscribe.test.ts` - API route tests

**Manual Testing:**

1. Enable notifications in ops dashboard
2. Create booking via ops → Verify notification received
3. Update booking → Verify notification received
4. Cancel booking → Verify notification received
5. Test quiet hours (change subscription settings, wait for quiet hour)
6. Test DND mode
7. Test with 2 staff members (both should receive)
8. Test with 2 devices per user (both should receive)

**Story Points:** 3  
**Estimated Hours:** 8 hours

---

#### Day 10: Deployment (All)

1. Deploy database migrations to production
2. Deploy backend code
3. Deploy frontend code
4. Monitor logs for first 100 notifications
5. Verify delivery rate >95%
6. Document any issues

**Story Points:** 2  
**Estimated Hours:** 4 hours

---

## Acceptance Criteria

### Functional

- [ ] **AC-1:** Staff can subscribe to notifications for each restaurant they manage
- [ ] **AC-2:** New booking triggers notification to all active staff members
- [ ] **AC-3:** Notifications respect role-based preferences (owner/admin/staff)
- [ ] **AC-4:** Quiet hours prevent non-urgent notifications during configured times
- [ ] **AC-5:** DND mode mutes all notifications for user
- [ ] **AC-6:** Clicking notification opens ops dashboard at relevant booking
- [ ] **AC-7:** Notification center shows unread count
- [ ] **AC-8:** Staff can unsubscribe devices from settings page

### Non-Functional

- [ ] **AC-9:** 95%+ delivery rate within 5 seconds (p95)
- [ ] **AC-10:** Works on Chrome 90+, Firefox 90+, Edge 90+ (desktop & mobile)
- [ ] **AC-11:** Service worker doesn't break existing ops dashboard functionality
- [ ] **AC-12:** All notification attempts logged to `ops_notification_logs`
- [ ] **AC-13:** Invalid FCM tokens automatically marked inactive
- [ ] **AC-14:** Zero false notifications (high signal-to-noise ratio)

---

## Success Metrics (30 Days)

| Metric                      | Target            | Measurement                                              |
| --------------------------- | ----------------- | -------------------------------------------------------- |
| **Opt-In Rate**             | 80% of ops users  | `(users with subscriptions / total ops users) * 100`     |
| **Delivery Success Rate**   | 95%+              | `(notifications sent / total attempts) * 100`            |
| **Delivery Latency (p95)**  | <5 seconds        | `p95(sent_at - created_at)` from `ops_notification_logs` |
| **FCM Error Rate**          | <3%               | `(failed notifications / total attempts) * 100`          |
| **Notification Engagement** | 60% click-through | Track via URL param: `?utm_source=ops_push`              |
| **No False Alarms**         | <1% complaints    | User feedback                                            |

---

## Deployment Plan

### Pre-Deployment Checklist

- [ ] All P0/P1 bugs fixed
- [ ] Unit tests passing
- [ ] Manual testing completed on Chrome, Firefox, Edge
- [ ] Firebase project created and configured
- [ ] Environment variables added to Vercel
- [ ] Database migrations reviewed
- [ ] Service account JSON securely stored
- [ ] Rollback plan documented

### Deployment Steps

1. **Staging (Day 9 EOD)**
   - Deploy migrations: `supabase db push --remote staging`
   - Deploy code: merge to `staging` branch
   - Configure Firebase staging credentials
   - Smoke test with 2-3 ops users

2. **Production (Day 10 AM)**
   - Backup database
   - Deploy migrations: `supabase db push --remote production`
   - Deploy code: merge to `main` branch
   - Enable feature flag for 10% of ops users
   - Monitor for 2 hours
   - Increase to 100% if metrics look good

3. **Post-Deployment Monitoring**
   - Tail Vercel logs: `vercel logs --prod --follow`
   - Check notification delivery stats:
     ```sql
     SELECT status, COUNT(*), AVG(EXTRACT(EPOCH FROM (sent_at - created_at))) as avg_delay
     FROM ops_notification_logs
     WHERE created_at > NOW() - INTERVAL '1 hour'
     GROUP BY status;
     ```

### Rollback Plan

If delivery rate drops below 50% or critical errors occur:

1. Disable feature flag
2. Revert last 5 commits: `git revert HEAD~5`
3. Push to production
4. Post status update
5. Schedule post-mortem

---

## Timeline Summary

| Week | Days | Focus              | Deliverables                                                          |
| ---- | ---- | ------------------ | --------------------------------------------------------------------- |
| 1    | 1-5  | Backend            | Firebase setup, DB migrations, push sender service, event integration |
| 2    | 6-10 | Frontend & Testing | Service worker, opt-in UI, notification center, testing, deployment   |

**Total Story Points:** 27  
**Total Estimated Hours:** ~50 hours across team

---

## Risk Assessment

| Risk                                                      | Probability | Impact   | Mitigation                                                       |
| --------------------------------------------------------- | ----------- | -------- | ---------------------------------------------------------------- |
| **FCM rate limits exceeded**                              | Medium      | High     | Implement exponential backoff, batch sends, monitor quota        |
| **Multi-restaurant users overwhelmed with notifications** | High        | Medium   | Role-based filtering, quiet hours, per-restaurant preferences    |
| **Service worker breaks ops dashboard**                   | Low         | Critical | Thorough testing, feature flag, scoped SW registration (`/ops/`) |
| **Staff don't enable notifications**                      | Medium      | High     | Auto-prompt on first ops dashboard visit, show benefits clearly  |
| **High notification volume causes performance issues**    | Medium      | Medium   | Async processing via Inngest, optimize DB queries with indexes   |

---

## Appendix

### Useful SQL Queries

**Check notification delivery stats:**

```sql
SELECT
  restaurant_id,
  notification_type,
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (sent_at - created_at))) as avg_delay_seconds
FROM ops_notification_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY restaurant_id, notification_type, status
ORDER BY restaurant_id, notification_type, count DESC;
```

**Find subscriptions per restaurant:**

```sql
SELECT
  r.name as restaurant_name,
  COUNT(DISTINCT ops.user_id) as unique_users,
  COUNT(ops.id) as total_subscriptions,
  COUNT(*) FILTER (WHERE ops.is_active) as active_subscriptions
FROM restaurants r
LEFT JOIN ops_push_subscriptions ops ON ops.restaurant_id = r.id
GROUP BY r.id, r.name
ORDER BY total_subscriptions DESC;
```

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-14  
**Maintained By:** Engineering Team  
**Review Frequency:** Weekly during sprint, monthly post-launch
