# [MEDIUM] Booking creation RPC logs full guest PII payloads

**File:** [`server/capacity/transaction.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/capacity/transaction.ts#L220-L221) (lines 220, 221)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-info-disclosure`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

createBookingWithCapacityCheck unconditionally logs the full RPC response and error objects with JSON.stringify. This helper is reached from the public booking creation flow, and the normalized RPC booking payload is a full booking record containing customer_name, customer_email, customer_phone, notes, idempotency_key, auth_user_id, and details. A successful guest booking therefore writes customer PII and user-controlled note content to server logs in production, and RPC errors may also expose database details into logs. This is not mitigated by auth because the public booking route intentionally invokes this path for unauthenticated guests.

## Recommendation

Remove the debug console.log statements or replace them with structured logging that records only non-sensitive fields such as restaurantId, bookingId, duplicate, capacity summary, and sanitized error code/message. Never log full booking records, guest contact fields, notes, idempotency keys, or raw PostgREST error objects.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-24)
