# [BUG] Default confetti statuses can cause repeated animation state churn

**File:** [`src/components/features/booking-state-machine/StatusTransitionAnimator.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/booking-state-machine/StatusTransitionAnimator.tsx#L51-L90) (lines 51, 59, 84, 86, 90)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-render-loop`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The default parameter confettiStatuses = ['completed'] creates a new array on every render, and the confetti effect depends on that array. statusChanged is memoized only by activeStatus while reading previousStatusRef.current, so after a real status change it can remain cached as true across state-only rerenders. When the timeout hides confetti, the unstable dependency causes the effect to run again and set showConfetti back to true, repeating the animation/state cycle.

## Recommendation

Hoist the default confetti status list to a stable module-level constant or memoize it, and compute status-change detection inside the effect before updating previousStatusRef so the changed flag cannot stay stale.

## Revalidation

**Verdict:** fixed

`src/components/features/booking-state-machine/StatusTransitionAnimator.tsx` now uses a stable module-level `DEFAULT_CONFETTI_STATUSES` value and computes the actual status transition inside the effect that updates `previousStatusRef`. Highlight and confetti timers are scheduled only for a consumed real transition, so later state-only rerenders from the hide timeout do not re-trigger confetti. `tests/components/StatusTransitionAnimator.test.tsx` verifies confetti does not restart after the timeout fires.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-26)
