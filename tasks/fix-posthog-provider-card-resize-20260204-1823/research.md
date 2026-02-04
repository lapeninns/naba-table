---
task: fix-posthog-provider-card-resize
timestamp_utc: 2026-02-04T18:23:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: PostHog Provider Stability + Booking Card Responsiveness

## Requirements

- Functional:
- Keep the PostHog provider wrapper stable to avoid full subtree remounts when lazy init completes.
- Ensure ops booking cards respond to viewport changes (resize/rotation) for collapsible layout.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve current analytics deferral and ops host suppression.
  - Avoid regressions in card accessibility or interaction states.

## Existing Patterns & Reuse

- PostHog provider: `lib/posthog/provider.tsx` currently lazy-loads `posthog-js` and toggles provider on init.
- Media query hook patterns exist in:
  - `src/components/features/customers/CustomersTable.tsx`
  - `src/components/features/seating/FloorPlanPage.tsx`

## External Resources

- None.

## Constraints & Risks

- Keep edits focused; no new analytics features.
- Avoid introducing additional bundle cost on ops pages.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Keep `PHProvider` mounted with a stable no-op client until real PostHog initializes.
- Replace one-time `matchMedia` read with a small `useMediaQuery` hook for responsive cards.
