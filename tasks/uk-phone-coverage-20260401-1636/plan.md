---
task: uk-phone-coverage
timestamp_utc: 2026-04-01T16:36:00Z
owner: github:@openai
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Broaden UK phone coverage across booking flows

## Objective

We will broaden shared UK-phone validation to cover the valid UK numbering-plan countries and enforce that same rule consistently across reserve, ops, and public booking API boundaries.

## Success Criteria

- [ ] Shared phone validation accepts representative valid UK numbering-plan types including geographic, mobile, freephone, non-geographic, VoIP, personal numbers, and Crown dependency ranges.
- [ ] Public booking create/list routes and guest self-serve update routes use the same shared UK-phone validation instead of length-only checks.
- [ ] Focused automated tests prove the accepted and rejected examples.

## Architecture & Components

- `reserve/shared/validation/contact.ts`: single source of truth for accepted UK numbering-plan phone values.
- `src/app/api/bookings/route.ts`: public create/list route uses shared phone validation.
- `src/app/api/bookings/[id]/route.ts`: guest self-serve update route uses shared phone validation.
- `tests/reserve/contactValidation.test.ts`: focused sample coverage for accepted/rejected numbers.

## Data Flow & API Contracts

- No payload shape changes.
- Validation contract change:
  - accept valid numbers on the supported `+44` numbering plan
  - reject invalid values even if length happens to fit

## Edge Cases

- Crown dependency mobile numbers that parse as `IM`, `GG`, or `JE`.
- Non-geographic but valid UK numbers such as `0300`, `0333`, `055`, `056`, `070`, `0800`, `0845`, and `0870`.
- Invalid reserved/sample values such as `01632 960123`.

## Testing Strategy

- Focused validation tests for accepted and rejected sample numbers.
- Typecheck after route-schema updates.

## Rollout

- No flags.
- Monitor booking validation failures after deploy for unexpected legitimate-number rejections.

## DB Change Plan (if applicable)

- None. Validation-layer only.
