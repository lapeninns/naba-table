---
task: fix-ops-booking-null-times
timestamp_utc: 2026-01-25T11:08:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix Ops Booking Null Times

## Requirements

- Functional: OpsBookingCard must not crash when start/end times are null; startIso/endIso should be valid ISO strings or guarded.
- Non-functional (a11y, perf, security, privacy, i18n): No new UI changes; avoid regressions.

## Existing Patterns & Reuse

- `BookingsList.tsx` normalizes start/end ISO strings via `toIsoTime` before passing to `OpsBookingCard`.
- `OpsBookingCard` assumes `booking.startIso` is always a valid ISO string when creating Dates.
- `booking-details/utils.ts` uses `formatBookingTime` to return `--:--` when time is missing, suggesting a placeholder option.

## External Resources

- None.

## Constraints & Risks

- Must follow AGENTS SDLC and update task artifacts.
- UI change requires DevTools MCP verification if behavior changes in UI.

## Open Questions (owner, due)

- Q: What is the intended fallback when ops booking times are null? (owner: github:@amanshresthaa, due: 2026-01-25)
  A: Use a safe midnight fallback (`00:00:00`) to keep ISO strings valid.

## Recommended Direction (with rationale)

- Restore a safe ISO fallback for null times in `toIsoTime` so `OpsBookingCard` never receives invalid dates.
