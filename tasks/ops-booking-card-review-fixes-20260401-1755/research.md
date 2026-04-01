---
task: ops-booking-card-review-fixes
timestamp_utc: 2026-04-01T17:55:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Ops Booking Card Review Fixes

## Requirements

- Functional:
  - Locked ops booking cards must expose the locked state with `aria-disabled="true"` at the row level.
  - `next-env.d.ts` must not depend on `.next/dev` artifacts that only exist during `next dev`.
  - The booking card view-model test suite must match the current lock-during-mutation policy.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve the existing card behavior and only correct accessibility semantics and test drift.
  - Keep the change scoped to the canonical ops booking card path and generated Next type shim.

## Existing Patterns & Reuse

- `src/components/features/dashboard/cards/OpsBookingCard.tsx` already carries row-level state (`role="article"`, `aria-labelledby`, `aria-busy`) and is the canonical place to expose row lock semantics.
- `components/ui/card.tsx` is a plain div wrapper, so accessibility attributes must be passed explicitly by callers.
- `src/components/features/dashboard/cards/opsBookingCardUtils.ts` already centralizes action-locking policy for Details and mutation actions.
- `tests/components/OpsBookingCard.test.tsx` already expects `aria-disabled`, confirming the intended DOM contract.

## External Resources

- None needed; the behavior is defined by repo policy, current implementation, and existing tests.

## Constraints & Risks

- AGENTS requires task artifacts and Chrome DevTools verification for UI changes.
- `next-env.d.ts` is normally generated, so the safe correction is to restore the stable baseline content rather than introduce custom type plumbing.
- One reported finding is not reproducible on the current branch: `getGuestIdentity()` already prefers `displayInitials` when present.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Add `aria-disabled` to the locked booking card row and drop the row-level `data-disabled` marker because assistive technology needs the ARIA state, and tests already encode that contract.
- Remove the `.next/dev/types/routes.d.ts` import from `next-env.d.ts` so typecheck works in CI and fresh clones.
- Update the stale `details.disabled` expectation in `tests/components/OpsBookingCardViewModel.test.ts` to reflect the current mutation-lock policy.
- Leave initials logic unchanged because the current implementation already preserves explicit `displayInitials` overrides.
