---
task: prevent-past-booking-modification
timestamp_utc: 2025-11-25T17:03:13Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Prevent updates/deletes of past bookings

## Requirements

- Functional: Past bookings should not be updateable or deletable; attempts should show an appropriate message and leave data unchanged.
- Non-functional: Maintain existing booking validation patterns; preserve API contract; ensure a11y for any UI messaging; no regressions to future booking edits.

## Existing Patterns & Reuse

- To be confirmed: reuse existing booking validation/middleware; check server and client guards around booking dates.

## External Resources

- N/A at this stage.

## Constraints & Risks

- Risk of blocking legitimate modifications when time zone handling is incorrect.
- Need to ensure both API and UI are protected to avoid bypasses.

## Open Questions (owner, due)

- What time zone is used to determine whether a booking is in the past? (owner: eng, due: before implementation)
- Are there admin overrides that should still work for past bookings? (owner: product, due: before release)

## Recommended Direction (with rationale)

- Add server-side guard that rejects update/delete when booking date < today in system/reference timezone to ensure invariant is enforced even if UI is bypassed.
- Add client-side disablement and messaging for better UX, mirroring server logic.
- Add tests covering boundary cases (same-day, timezone). Use existing testing stack.
