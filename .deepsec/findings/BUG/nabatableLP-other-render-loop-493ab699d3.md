# [BUG] Confetti animation can restart indefinitely after a status change

**File:** [`src/components/features/booking-state-machine/StatusTransitionAnimator.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/booking-state-machine/StatusTransitionAnimator.tsx#L51-L90) (lines 51, 59, 84, 90)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-render-loop`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The default `confettiStatuses = ['completed']` creates a new array on every render, and the confetti effect depends on that array. After a status change, `statusChanged` is memoized only by `activeStatus`, so it can remain true across later state-only renders. When the hide timeout sets `showConfetti` back to false, the unstable dependency causes the effect to run again, see `statusChanged` as still true, and set `showConfetti` back to true. This can repeat every timeout interval when the component is used with the default prop. This is not a security vulnerability, but it can cause persistent animation/state churn.

## Recommendation

Hoist the default confetti status array to a module-level constant and derive the status-change event inside one effect that updates `previousStatusRef`, so the confetti trigger is consumed once per actual status transition.

## Revalidation

**Verdict:** fixed

The default confetti status array is now hoisted, and `StatusTransitionAnimator` consumes transition detection in the same effect that updates `previousStatusRef`. Once a transition has scheduled the confetti hide timeout, the timeout's state update rerender sees no new status transition and cannot restart the animation. `tests/components/StatusTransitionAnimator.test.tsx` covers the no-restart behavior with fake timers.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-26)
