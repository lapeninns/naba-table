---
task: fix-wizard-draft-expiry
timestamp_utc: 2026-04-05T15:50:00Z
owner: github:@amankumarshresthaa
reviewers: [github:@amankumarshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Research: Reservation wizard early draft expiry

## Requirements

- Functional:
  - Stop the reservation wizard from surfacing `"Draft expired—let’s refresh availability."` for unrelated or stale drafts.
  - Preserve legitimate draft recovery for the active restaurant booking flow.
  - Keep the canonical reservation wizard path unchanged while tightening storage behavior.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No UI accessibility regressions.
  - No added network work on initial load.
  - Contact data must remain scoped to the intended draft and existing browser storage strategy.

## Existing Patterns & Reuse

- Draft persistence lives in `reserve/features/reservations/wizard/hooks/useWizardDraftStorage.ts`.
- The wizard mount/reset flow lives in `reserve/features/reservations/wizard/hooks/useReservationWizard.ts`.
- The reserve app has both generic routes (`/`, `/new`) and restaurant-specific routes (`/r/:slug`) in `reserve/app/routes.tsx`.
- The Next.js marketing booking flow always provides a restaurant slug up front via `src/components/features/booking/wizard/ReservationWizardClient.tsx`.

## External Resources

- None needed; the issue is repo-local state/storage behavior.

## Constraints & Risks

- This is a regression fix, so verification-first is appropriate before writing tests.
- The app still supports a legacy global draft key (`reserve.wizard.draft`); tightening fallback behavior could affect old drafts created from generic routes.
- Browser storage uses both `localStorage` and `sessionStorage`; the fix should stay narrow and avoid redesigning persistence.

## Open Questions (owner, due)

- Q: Should generic reserve routes continue restoring legacy global drafts when no restaurant slug is known?
  A: For this fix, yes; the bug is restaurant-scoped flows reading unrelated legacy drafts.

## Recommended Direction (with rationale)

- Prevent restaurant-scoped wizard loads from falling back to the legacy global draft key when the current slug-specific key is absent.
- Keep legacy fallback only for unscoped/generic wizard entry points.
- Add focused regression tests around `loadWizardDraft(expectedSlug)` so stale global drafts cannot trigger false expiry alerts for slugged flows.
