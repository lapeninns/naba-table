---
task: fix-wizard-restaurant-context
timestamp_utc: 2026-04-13T16:50:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Research: Fix Wizard Restaurant Context

## Requirements

- Functional:
  - Guest booking flows must submit successfully when launched from a slug-based route, even before `restaurantId` has been hydrated into wizard state.
  - The reservation wizard must retain a valid restaurant context in state for downstream flows such as submission and timeout recovery.
  - Existing server-rendered booking pages that already pass `restaurantId` must continue to work unchanged.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Keep the canonical booking API contract as the source of truth for restaurant resolution.
  - Avoid restoring env-based default restaurant fallbacks.
  - Keep the fix narrowly scoped to the reservation wizard and its proof paths.

## Existing Patterns & Reuse

- `reserve/features/reservations/wizard/model/transformers.ts` currently blocks draft creation unless `details.restaurantId` is present.
- `src/app/api/bookings/route.ts` already accepts either `restaurantId` or `restaurantSlug` and resolves the restaurant from the slug when needed.
- `reserve/features/reservations/wizard/hooks/useReservationWizard.ts` contains the canonical slug-based venue hydration effect, but it currently skips whenever name, timezone, or address are already populated, even if `restaurantId` is still blank.
- `reserve/features/reservations/wizard/hooks/usePlanStepForm.ts` already attempts to hydrate `restaurantId` from the schedule response, so the remaining failure is a stricter draft invariant plus an earlier hydration gap.
- `reserve/pages/WizardPage.tsx` still boots the wizard from slug-only state (`/r/:slug`), which is the clearest reproduction path for missing `restaurantId`.

## External Resources

- None needed; this is a repo-internal contract and state-management regression.

## Constraints & Risks

- Relaxing the draft invariant must not allow bookings with neither `restaurantId` nor `restaurantSlug`.
- Timeout recovery still benefits from a hydrated `restaurantId`, so the wizard should continue eagerly backfilling the id when only the slug is known.
- This is a regression fix, so verification-first analysis is appropriate before tightening tests.

## Open Questions (owner, due)

- Q: Should the wizard require `restaurantId` specifically, or mirror the API contract and allow either id or slug?
  A: Mirror the API contract and require at least one restaurant identifier. Owner: github:@amanshresthaa, due: 2026-04-13

## Recommended Direction (with rationale)

- Update `buildReservationDraft()` to require at least one of `restaurantId` or `restaurantSlug`, matching the booking API boundary instead of a stricter client-only rule.
- Tighten the slug-based venue hydration effect so it still fetches venue details whenever `restaurantId` is missing, even if display metadata was already preloaded.
- Add focused regression coverage proving slug-only draft building succeeds and the wizard no longer depends on deprecated default-restaurant env state.
