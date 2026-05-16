# [MEDIUM] Completed-status replay can requeue review emails

**File:** [`src/app/api/ops/bookings/[id]/status/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/bookings/[id]/status/route.ts#L231-L260) (lines 231, 253, 260)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `expensive-api-abuse`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The completed branch always loads the full booking and calls enqueueCheckOutSideEffects after applyTransition succeeds, even when the booking was already completed and persistLifecycleTransition performed no state change. Because the route has no replay/rate-limit guard, an authorized user can repeatedly PATCH {"status":"completed"} for a completed booking on its reservation date and repeatedly requeue review_request email work. The email queue uses a dedupe key, but scheduleEmailIntent upserts a fresh pending row for the same key, so already-sent intents can be revived.

## Recommendation

Only enqueue checkout side effects when the persisted transition actually changed the booking into completed, make email intent scheduling idempotent for sent/cancelled intents, and add a narrow per-booking/user rate limit for lifecycle writes.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-05)
