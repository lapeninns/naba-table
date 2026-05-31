# [HIGH_BUG] Repeated check-out POSTs overwrite checkout time and can duplicate side effects

**File:** [`src/app/api/ops/bookings/[id]/check-out/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/ops/bookings/[id]/check-out/route.ts#L20-L115) (lines 20, 60, 71, 82, 93, 115)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-lifecycle-idempotency`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route passes payload.performedAt ?? null into prepareCheckOutTransition. The transition helper treats any value other than undefined as an explicit timestamp override, so an omitted performedAt becomes null, is normalized to now, and forces checked_out_at to be rewritten. Since same-state completed -> completed transitions are allowed, a repeated POST with no body changes the completed booking again. Because persistResult.result.changed is then true, the route re-runs assignment cleanup and enqueues check-out side effects, which can duplicate review-request scheduling while corrupting the original checkout timestamp.

## Recommendation

Preserve undefined for omitted performedAt, make completed check-out idempotent when no explicit timestamp is supplied, and only enqueue check-out side effects for the first real transition to completed. Add tests for repeated no-body check-out calls.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-25)
