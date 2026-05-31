# [MEDIUM] Full booking RPC payload is logged on public booking creation

**File:** [`server/capacity/transaction.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/capacity/transaction.ts#L220-L221) (lines 220, 221)
**Project:** nabatableLP
**Severity:** MEDIUM  •  **Confidence:** high  •  **Slug:** `other-info-disclosure`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

createBookingWithCapacityCheck unconditionally logs JSON.stringify(data, null, 2) and JSON.stringify(error, null, 2) for the create_booking_with_capacity_check RPC result. The normalized RPC booking payload is a full BookingRecord containing customer_name, customer_email, customer_phone, notes, idempotency_key, auth_user_id, and details. This helper is reached from the public POST /api/bookings creation flow, so unauthenticated guest submissions can cause guest PII and free-form notes to be written to server logs, which often have broader access and longer retention than the booking database. Raw RPC error objects may also include database details.

## Recommendation

Remove these debug console.log statements. If operational logging is needed, log only non-sensitive fields such as restaurantId, bookingId, duplicate status, capacity summary, and sanitized error code/message. Do not log full booking records, guest contact fields, notes, idempotency keys, auth user IDs, details, or raw PostgREST error objects.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-24)
