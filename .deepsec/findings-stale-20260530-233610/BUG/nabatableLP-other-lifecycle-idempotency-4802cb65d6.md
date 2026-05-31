# [BUG] Repeated check-in POSTs overwrite the original check-in timestamp

**File:** [`src/app/api/ops/bookings/[id]/check-in/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/ops/bookings/[id]/check-in/route.ts#L18-L80) (lines 18, 58, 69, 80)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-lifecycle-idempotency`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The body schema makes performedAt optional, but the route passes payload.performedAt ?? null into prepareCheckInTransition. The transition helper distinguishes undefined from null: undefined means no explicit timestamp override, while null is normalized to the current time and treated as an explicit overwrite. Because same-state check-in is allowed, a retry or repeated POST with no body after a booking is already checked in rewrites checked_in_at and appends another history entry instead of becoming a no-op. This corrupts operational/audit data even though session, CSRF, membership, and rate-limit checks are present in the shared lifecycle guard.

## Recommendation

Pass payload.performedAt directly so absence remains undefined, or add an explicit hasPerformedAt flag. Add regression coverage that a second check-in without performedAt preserves checked_in_at and returns changed=false/no new history.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-25)
