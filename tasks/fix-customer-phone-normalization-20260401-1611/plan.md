---
task: fix-customer-phone-normalization
timestamp_utc: 2026-04-01T16:11:00Z
owner: github:@openai
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Fix customer phone normalization duplicate collisions

## Objective

We will normalize UK phone numbers consistently across customer lookup, booking recovery, and guest self-serve booking ownership checks so equivalent formats like `07...`, `44...`, and `+44...` behave as the same customer/contact throughout the booking flow.

## Success Criteria

- [x] `upsertCustomer` treats `079...`, `4479...`, and `+4479...` as the same customer phone for UK numbers.
- [x] Ops booking creation no longer throws `23505` for an existing customer when the only supplied contact is an equivalent UK phone format.
- [x] Reserve timeout recovery matches equivalent UK phone formats.
- [x] Guest self-serve booking ownership checks no longer fail only because the same phone was entered in a different UK format.
- [x] Focused automated tests cover normalization behavior and timeout-recovery matching.

## Architecture & Components

- `server/customers.ts`: single source of truth for customer phone normalization and upsert behavior.
- `reserve/shared/validation/contact.ts`: shared comparable-phone helper reused on server and reserve client.
- `reserve/features/reservations/wizard/utils/timeoutRecovery.ts`: reserve-side timeout recovery uses the shared comparable-phone helper.
- `src/app/api/bookings/[id]/route.ts`: guest self-serve ownership check compares normalized phone values.
- `tests/server/customers.test.ts` and `tests/reserve/timeoutRecovery.test.ts`: focused proof for normalization, upsert matching, and timeout recovery.

## Data Flow & API Contracts

- Endpoint callers remain unchanged: `POST /api/ops/bookings` and `POST /api/bookings`.
- Internal invariant:
  - valid UK numbers normalize to E.164 digits without `+`
  - other values normalize to digits-only fallback

## UI/UX States

- No direct UI change.
- Error behavior should improve by reusing the correct customer record instead of surfacing a duplicate-insert failure.

## Edge Cases

- Existing customer stored from a previous booking with `+44...`; new ops booking submitted as `07...`.
- Existing customer stored from a previous booking with `07...`; new flow submitted as `+44...`.
- Non-UK or malformed values that cannot be parsed as GB numbers.
- Empty phone should remain empty and continue to use existing contact validation rules.
- Timed-out reservation create where API returns bookings with `+44...` but the draft used `07...`.
- Guest self-serve update where the same phone is re-entered in a different UK format.

## Testing Strategy

- Verification-first regression fix: confirm the current mismatch and then add guard tests on the canonical server path.
- Unit tests for `normalizePhone`.
- Focused `upsertCustomer` test proving a `07...` request finds an existing `+44...` customer instead of inserting.
- Focused timeout recovery test proving a booking returned with `+44...` still matches a draft entered as `07...`.

## Rollout

- No flag changes.
- Monitor ops booking logs for disappearance of `customers_restaurant_id_phone_normalized_key` collisions after deploy.
- Watch guest self-serve support reports for fewer “booking not found / cannot update own booking” cases caused only by phone-format differences.

## DB Change Plan (if applicable)

- None. This is an application-layer normalization fix.
