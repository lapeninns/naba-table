---
task: set-default-buffer-0
timestamp_utc: $ts
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Set Default Buffer to 0

## Objective

Remove the default post-buffer so bookings only block for their dining duration.

## Success Criteria

- [ ] Default buffer post set to 0 for lunch and dinner in `defaultVenuePolicy`.
- [ ] No other policy values changed.

## Architecture & Components

- `server/capacity/policy.ts` defaultVenuePolicy buffers.

## Data Flow & API Contracts

- N/A

## UI/UX States

- N/A

## Edge Cases

- Restaurants relying on defaults will have tighter turnover.

## Testing Strategy

- No automated tests; manual inspection of policy values.

## Rollout

- Immediate, global.

## DB Change Plan (if applicable)

- N/A
