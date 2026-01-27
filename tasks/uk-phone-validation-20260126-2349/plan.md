---
task: uk-phone-validation
timestamp_utc: 2026-01-26T23:49:11Z
owner: github:@copilot
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Expand UK Phone Validation Coverage

## Objective

We will accept more valid UK phone numbers across ops and customer flows while preserving DB constraints and a single canonical validation rule.

## Success Criteria

- [x] Valid UK landlines and other non-07 numbers are accepted.
- [x] Invalid UK numbers and non-UK numbers are rejected.
- [x] All phone validation continues to respect the 7–20 length constraint.
- [x] Existing route tests continue to pass.

## Architecture & Components

- `reserve/shared/validation/contact.ts`: canonical phone validation and constants.
- `server/customers.ts`: canonical phone storage and normalization.
- `src/app/api/ops/bookings/schema.ts`: ops boundary validation.
- `reserve/features/reservations/wizard/model/schemas.ts`: wizard boundary validation and copy.

## Data Flow & API Contracts

- Boundary invariant: phone inputs must represent valid GB numbers and respect the DB length constraint.
- Storage invariant: phone values written to `customers.phone` must be <=20 chars.

## Edge Cases

- UK landlines with spaces/parentheses.
- `+44` and `44` prefixes.
- Very short/long inputs.
- Non-GB numbers.

## Testing Strategy

- Add shared validation tests that cover multiple UK number types.
- Run targeted route tests for ops and customer bookings.

## Rollout

- No new flag; deploy normally and monitor phone validation errors.

## DB Change Plan (if applicable)

- None.
