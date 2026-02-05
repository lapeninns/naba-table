---
task: set-default-buffer-0
timestamp_utc: $ts
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Set Default Buffer to 0

## Requirements

- Functional: Set default booking buffer (pre/post) to 0 minutes.
- Non-functional (a11y, perf, security, privacy, i18n): N/A

## Existing Patterns & Reuse

- Default buffers defined in `server/capacity/policy.ts` under `defaultVenuePolicy.services`.
- Booking windows use `getBufferConfig()` in `server/capacity/table-assignment/booking-window.ts`.

## External Resources

- N/A

## Constraints & Risks

- Global change affects all restaurants using default policy.
- Shorter buffers increase table turnover; ensure this is desired.

## Open Questions (owner, due)

- Confirm this change should be global for all venues using defaults (owner: user).

## Recommended Direction (with rationale)

- Update default buffer `post` values from 5 to 0 (and keep `pre` at 0) in `server/capacity/policy.ts`.
