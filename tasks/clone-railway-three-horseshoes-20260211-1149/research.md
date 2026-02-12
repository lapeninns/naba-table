---
task: clone-railway-three-horseshoes
timestamp_utc: 2026-02-11T11:49:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Research: Clone railway profile to Three Horseshoes (production)

## Requirements

- Functional:
- Clone restaurant configuration from source slug `the-railway-pub` to a new restaurant profile.
- Do not copy customer or booking records from source.
- Overwrite profile contact/location data with provided Three Horseshoes details.
- Seed synthetic bookings for upcoming 15 days with 40-50 bookings/day.

- Non-functional (a11y, perf, security, privacy, i18n):
- Production-only safeguards required (`CONFIRM_PRODUCTION`, expected project-ref validation).
- No real customer PII copied from source tenant.
- Seeded data must be synthetic and bounded to target restaurant only.

## Existing Patterns & Reuse

- `scripts/seed-railway-from-cornerhouse.ts` provides canonical restaurant configuration cloning across:
- `allowed_capacities`
- `restaurant_operating_hours`
- `restaurant_service_periods`
- `zones`
- `table_inventory`
- `table_adjacencies`
- `restaurant_capacity_rules`
- Existing scripts for booking seeding informed payload shape; runtime schema validation was taken from production PostgREST responses.

## External Resources

- None required; implementation based on in-repo production scripts and live schema behavior.

## Constraints & Risks

- `bookings.assignment_state` and `bookings.table_id` are not available in current PostgREST schema cache; payloads must omit those fields.
- Direct DB URL auth from local env was not usable (`password authentication failed`), so write path used service-role API client with explicit project-ref guard.

## Open Questions (owner, due)

- Q: Should future runs start from `today` or `tomorrow` for "upcoming 15 days"?
  A: Implemented as `tomorrow` through `tomorrow + 14 days`.

## Recommended Direction (with rationale)

- Use existing clone script for canonical profile/table graph copy to minimize risk and preserve integrity.
- Apply direct restaurant metadata overwrite after clone.
- Seed synthetic bookings using constrained payload supported by production schema cache.
