---
task: booking-details-dialog-revamp
timestamp_utc: 2025-12-28T14:19:53Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Booking Details Lint Fixes

## Requirements

- Functional: resolve eslint import/order errors and react-hooks/preserve-manual-memoization warnings in booking-details.
- Non-functional (a11y, perf, security, privacy, i18n): no behavior change; keep UI output identical.

## Existing Patterns & Reuse

- Use current booking-details structure (BookingDialog.tsx, utils.ts, hooks/useTableAssignment.ts).

## External Resources

- None.

## Constraints & Risks

- Adjust only import ordering and memo dependencies to avoid behavior changes.
- Manual UI QA via Chrome DevTools MCP if UI change verification is required.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Reorder/move imports to satisfy lint rules.
- Broaden memo dependencies to align with React Compiler inference and avoid lint warnings.
