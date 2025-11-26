---
task: remove-default-restaurant
timestamp_utc: 2025-11-26T10:58:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Plan: Remove default restaurant fallback

## Objective

Remove baked-in default restaurant configuration so the app requires explicit restaurant context (env or request) instead of silently using the seeded "White Horse Pub".

## Success Criteria

- [ ] No hardcoded default restaurant ID/slug/venue remains in code or env samples.
- [ ] If restaurant context is missing, APIs return clear 400 errors; UI links fall back to a neutral "choose a restaurant" path instead of a specific slug.
- [ ] Tests updated to supply restaurant context explicitly.

## Steps

1. Make default restaurant envs optional without fallback values (config/env.schema, env helpers, venue config files) and remove seeded constants.
2. Update server helpers (getDefaultRestaurantId) to require explicit env or throw a typed error; adjust callers (availability/bookings APIs and tests) to pass restaurant id/slug or surface 400 if absent.
3. Update UI entry points that rely on DEFAULT_RESTAURANT_SLUG to link to a discovery/selection route (or display a prompt) when no default exists.
4. Refresh documentation/env examples and add verification notes.

## Testing

- Update and run relevant route tests for bookings/availability to cover missing-restaurant error.
- Quick smoke of landing page links to ensure they no longer point to removed default slug.
