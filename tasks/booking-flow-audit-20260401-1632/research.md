---
task: booking-flow-audit
timestamp_utc: 2026-04-01T16:32:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Booking Flow Audit Follow-up Fixes

## Requirements

- Functional:
  - Preserve the new canonical UK phone normalization behavior across booking and waitlist flows.
  - Prevent duplicate waitlist rows when the same UK phone exists in legacy local format and new canonical E.164 format.
  - Keep guest self-serve ownership checks stable for legacy or inconsistently normalized stored emails.
  - Remove misleading dead UI-state code in ops booking cards.
  - Keep framework-generated typing files safe for fresh clones and CI.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No change to accessible interaction contracts.
  - No regression to booking authorization checks.
  - No new database migration in this pass.

## Existing Patterns & Reuse

- Canonical phone comparison already lives in `reserve/shared/validation/contact.ts`.
- Booking ownership checks already normalize incoming email and phone input before comparison in `src/app/api/bookings/[id]/route.ts`.
- Waitlist create/update logic already centralizes storage in `server/bookings.ts`.
- UI card disabled/loading affordances already flow through `showLoading` in `src/components/features/dashboard/cards/OpsBookingCard.tsx`.

## External Resources

- None needed for this follow-up; the work stays inside repo-local invariants and previously verified phone rules.

## Constraints & Risks

- Existing waitlist rows may still contain legacy `079...` values from older code.
- A pure storage-format switch without dual-read compatibility would allow cross-version duplicates.
- `next-env.d.ts` should remain in Next.js-generated safe form; hand-edited dev-only imports are fragile.

## Open Questions (owner, due)

- Q: Do we need a one-time waitlist backfill migration?
  A: Not in this patch. Dual-read compatibility plus forward rewrite-on-touch is enough for safe rollout. Owner: maintainers. Due: post-deploy review.

## Recommended Direction (with rationale)

- Add backward-compatible waitlist lookup candidates so new code can find both canonical and legacy stored phones, then rewrite touched rows to canonical storage.
- Normalize stored booking emails before self-serve ownership comparison to harden legacy-row compatibility without changing the API contract.
- Remove dead visual-disabled code from ops booking cards to match actual caller behavior and reduce maintenance confusion.
- Restore `next-env.d.ts` to the standard generated form so CI and fresh clones do not depend on `.next/dev`.
