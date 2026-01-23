---
task: fix-unused-bookingtype
timestamp_utc: 2026-01-23T00:39:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Remove unused BookingType import

## Requirements

- Functional: remove unused `BookingType` import to pass lint (`@typescript-eslint/no-unused-vars`).
- Non-functional: no behavior change; keep route handler logic intact.

## Existing Patterns & Reuse

- Follow existing route handler structure in `src/app/api/bookings/[id]/route.ts`.

## External Resources

- None.

## Constraints & Risks

- Must follow AGENTS SDLC phases and keep change minimal.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Remove the unused import only; avoids behavior changes and satisfies lint.
