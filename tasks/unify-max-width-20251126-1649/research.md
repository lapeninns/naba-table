---
task: unify-max-width
timestamp_utc: 2025-11-26T16:49:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Research: Unify page max width to 7xl

## Requirements

- Functional: Align page container widths to a single `max-w-[80vw]` across site shells.
- Non-functional: Preserve existing spacing/padding; avoid layout regressions.

## Existing Patterns & Reuse

- Shared components `PageSection` and `PageHero` already use `max-w-[80vw]`.
- Several shells/components use `max-w-6xl` or `max-w-5xl` variants.

## External Resources

- None.

## Constraints & Risks

- Potential visual overflow on narrow layouts if padding insufficient.

## Open Questions (owner, due)

- None noted.

## Recommended Direction (with rationale)

- Update shared shells and pages to consistently use `max-w-[80vw]`; prefer using shared shell components where present to centralize width control.
