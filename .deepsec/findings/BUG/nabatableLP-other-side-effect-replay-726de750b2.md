# [BUG] Repeated no-op check-out can replay review-email side effects

**File:** [`src/app/api/ops/bookings/[id]/check-out/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/bookings/[id]/check-out/route.ts#L80-L116) (lines 80, 91, 108, 115, 116)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-side-effect-replay`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

After persistLifecycleTransition succeeds, the route always clears assignments and schedules check-out side effects. If the booking is already completed with checked_out_at set, prepareCheckOutTransition returns a no-op transition, but this route still calls enqueueCheckOutSideEffects. The email queue uses a dedupe key, but its scheduler upserts the row back to pending, so a staff member can repeatedly requeue a review request after it has already been sent.

## Recommendation

Only run post-checkout side effects when the transition actually changed state to completed, or have persistLifecycleTransition expose a changed flag and skip review scheduling for no-op transitions.

## Revalidation

**Verdict:** fixed

`persistLifecycleTransition` now returns `changed: false` for `transition.skipUpdate` no-op transitions and `changed: true` for persisted updates. `src/app/api/ops/bookings/[id]/check-out/route.ts` only clears table assignments, invalidates dashboard caches, and schedules review-request side effects when `changed` is true. The deprecated status completion route uses the same guard. `tests/server/ops-booking-checkout-route.test.ts` verifies no-op check-out responses do not replay assignment cleanup, cache invalidation, or check-out side effects.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-25)
