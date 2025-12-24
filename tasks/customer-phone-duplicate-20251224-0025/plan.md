---
task: customer-phone-duplicate
timestamp_utc: 2025-12-24T00:24:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Handle phone-unique customer conflicts

## Objective

Gracefully reuse an existing customer when the same phone (normalized) already exists for a restaurant, preventing 23505 errors during booking.

## Success Criteria

- Unique violation on `customers_restaurant_id_phone_normalized_key` no longer bubbles; existing customer is returned.
- Behavior for email conflicts remains unchanged.
- Tests cover phone conflict and pass.

## Architecture & Components

- Update `server/customers.ts` unique-violation recovery to also query by `phone_normalized`.
- Keep marketing opt-in and name update logic intact.

## Testing Strategy

- Add unit test for phone conflict in `server/__tests__/customers.test.ts`.
- Run targeted Vitest for the customers suite.

## Rollout

- No flags; small server-side change.
- Monitor booking logs for repeated 23505 after deploy.
