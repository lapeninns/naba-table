---
task: modal-close-padding
timestamp_utc: 2025-12-01T23:23:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Increase close button safe area on booking modal

## Requirements

- Functional: Add additional margin/padding so clicking the modal close (X) does not inadvertently trigger underlying controls; keep visual layout consistent.
- Non-functional (a11y, perf, security, privacy, i18n): Maintain keyboard/screen-reader operability; avoid CLS; no new latency or network calls.

## Existing Patterns & Reuse

- Modal likely uses shared dialog component in `src/components/features/bookings` (text "Manage bookings"). Will reuse existing modal wrapper styles rather than creating new primitives.
- Shadcn/Dialog or custom header layout already present; prefer adjusting padding within the current modal container/header instead of adding new elements.

## External Resources

- None needed; pattern change only.

## Constraints & Risks

- Must not shrink available content space too much on smaller screens.
- Need to ensure hit area remains 44px min (per a11y). Avoid overlapping with tabs.

## Open Questions (owner, due)

- None identified; single UI tweak.

## Recommended Direction (with rationale)

- Locate modal shell component for booking management header and increase padding/top-right spacing around the close icon (using Tailwind classes) to provide a safe click buffer without altering overall layout. Keep a11y labels intact.
