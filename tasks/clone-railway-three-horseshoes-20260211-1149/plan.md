---
task: clone-railway-three-horseshoes
timestamp_utc: 2026-02-11T11:49:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Plan: Clone + Seed Three Horseshoes

## Objective

We will create a new restaurant tenant cloned from `the-railway-pub` config and seed synthetic demand data so ops can test and use a realistic booking calendar.

## Success Criteria

- [x] New restaurant created with slug `three-horseshoes`.
- [x] Core restaurant configuration copied from source profile.
- [x] Contact/address/map details overwritten with provided Three Horseshoes data.
- [x] No source customer/booking records copied.
- [x] 15 future days seeded with 40-50 bookings/day.

## Architecture & Components

- Existing script: `scripts/seed-railway-from-cornerhouse.ts` for canonical config clone.
- Service-role Supabase client for targeted post-clone profile update.
- Service-role Supabase client for synthetic booking/customer/assignment generation.

## Data Flow & API Contracts

- Clone inputs:
- `SOURCE_SLUG=the-railway-pub`
- `TARGET_NAME=Three Horseshoes`
- `OWNER_USER_ID=<existing owner user id>`
- `CONFIRM_PRODUCTION=true`
- `EXPECTED_PROJECT_REF=ndxmivcrehsacuerwxtm`

- Restaurant overwrite fields:
- `name`, `address`, `contact_phone`, `contact_email`, `google_map_url`, `google_review_url`

- Booking seed inserts:
- `customers`: synthetic rows per seeded booking
- `bookings`: canonical supported fields only
- `booking_table_assignments`: one assignment per booking

## UI/UX States

- Not applicable (data operation only).

## Edge Cases

- PostgREST schema cache missing some booking columns; remove unsupported fields from payload.
- Ensure target has active tables before assignment generation.

## Testing Strategy

- Dry-run clone before apply.
- Post-apply verification queries:
- Restaurant profile details.
- Per-day booking counts and date range.
- Assignment count equals booking count.

## Rollout

- No feature flag.
- One-time production data operation with guards and explicit summary checks.

## DB Change Plan (if applicable)

- No schema migration.
- Data-only operation in production with pre-check and post-check queries.
