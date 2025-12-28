---
task: fix-booking-details-lint
timestamp_utc: 2025-12-28T12:13:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix BookingDetailsDialogV3 lint warnings

## Requirements

- Functional:
  - Remove unused imports/vars in `BookingDetailsDialogV3.tsx` to satisfy ESLint (warnings treated as errors).
- Non-functional (a11y, perf, security, privacy, i18n):
  - No UI/behavior changes.

## Existing Patterns & Reuse

- Keep component logic unchanged; remove unused declarations only.

## External Resources

- None.

## Constraints & Risks

- Must follow AGENTS policy and avoid scope creep.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Remove unused imports and variables to satisfy lint without behavior change.
