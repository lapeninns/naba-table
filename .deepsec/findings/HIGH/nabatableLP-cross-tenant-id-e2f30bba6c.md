# [HIGH] Modification flow trusts caller-supplied restaurant_id under service role

**File:** [`server/bookings/modification-flow.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/bookings/modification-flow.ts#L87-L142) (lines 87, 88, 92, 142)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

beginBookingModificationFlow builds pendingPayload by spreading the caller-provided payload and then updates the booking through the supplied client. In the public full-update caller, that client is a service-role client and payload.restaurant_id can come from the request body when table realignment is required. Because this helper receives existingBooking but never checks that payload.restaurant_id matches existingBooking.restaurant_id, a guest who can modify their own booking can submit another public restaurant UUID and move the booking into another tenant before auto-assignment runs, causing cross-tenant data pollution and potential table holds/assignments in the victim restaurant.

## Recommendation

Do not accept restaurant_id from modification payloads. Derive the restaurant id from existingBooking.restaurant_id, reject any mismatch, and constrain updates with both id and the original restaurant_id. Prefer a tenant-scoped client for the existing restaurant and add regression tests for public booking updates that include a different restaurantId.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-28)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
