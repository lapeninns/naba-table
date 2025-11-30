---
task: booking-edit-party-size
timestamp_utc: 2025-11-30T14:08:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Align edit booking party size field with create form

## Objective

Enable editing an existing booking's party size using the same field and validation as the create booking form so PUT /api/bookings/:id succeeds when party size changes.

## Success Criteria

- [ ] Edit booking form uses identical UI component and validation rules for party size as create form.
- [ ] PUT /api/bookings/:id accepts updates including party size without 400 errors for valid input.
- [ ] No regression in create booking flow.

## Architecture & Components

- `components/dashboard/EditBookingDialog.tsx`: swap plain number input for the shared `PartySizeField` stepper used in create flow.
- Keep zod schema unchanged (already mirrors create limits via MIN/MAX constants).

## Data Flow & API Contracts

Endpoint: PUT /api/bookings/:id
Request: includes party size field with same name/type as create payload.
Response: booking resource.
Errors: surface API errors in form.

## UI/UX States

- Loading: existing booking fetch.
- Success: confirmation upon save.
- Error: validation or API error displayed inline.

## Edge Cases

- Clamp decrement at MIN_ONLINE_PARTY_SIZE; clamp increment at MAX_ONLINE_PARTY_SIZE.
- Prevent empty/NaN party size submissions so dashboard schema passes.

## Testing Strategy

- Manual: edit booking to change party size; ensure request succeeds.
- Automated: update relevant unit/validation tests if present.
- A11y: confirm field labeling/focus consistent.

## Rollout

- No feature flag; direct fix.
- Verify locally and update task artifacts.

## DB Change Plan (if applicable)

- None.
