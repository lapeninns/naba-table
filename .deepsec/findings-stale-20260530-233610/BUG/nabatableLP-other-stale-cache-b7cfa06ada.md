# [BUG] Occasion mutations leave the active occasion catalog cache stale

**File:** [`src/app/api/ops/occasions/[key]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/ops/occasions/[key]/route.ts#L52-L145) (lines 52, 53, 75, 80, 137, 145)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-stale-cache`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

PATCH can change is_active and DELETE soft-deletes an occasion, but the handler returns after updating booking_occasions without invalidating the cached occasion catalog used by booking validation. server/occasions/validateBookingType.ts accepts a cached active match before forcing a refresh, so a recently deactivated or deleted occasion can still be accepted for new bookings until the in-memory catalog TTL expires.

## Recommendation

Invalidate the occasion catalog cache after successful create/update/delete operations, and consider enforcing active/non-deleted occasion checks in the booking write transaction so cache staleness cannot admit disabled booking types.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)
