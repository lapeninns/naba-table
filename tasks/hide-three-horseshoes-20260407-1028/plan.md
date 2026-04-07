---
task: hide-three-horseshoes
timestamp_utc: 2026-04-07T10:28:00Z
owner: github:@OpenAI
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Hide Three Horseshoes From Production

## Objective

We will make inactive restaurants disappear from public Nabatable surfaces so that setting Three Horseshoes inactive removes its production detail and booking pages without introducing a second visibility mechanism.

## Success Criteria

- [ ] Public restaurant listings exclude inactive restaurants.
- [ ] Public slug lookup returns not found for inactive restaurants.
- [ ] Public detail and booking pages render `notFound()` for inactive venues.
- [ ] Ops restaurant update contracts can persist `isActive`.

## Architecture & Components

- `server/restaurants/getRestaurantBySlug.ts`: enforce active-only slug resolution for public readers.
- `server/restaurants/listRestaurants.ts`: exclude inactive restaurants from public listings.
- `src/app/api/ops/restaurants/schema.ts`, `server/restaurants/update.ts`, `src/app/api/ops/restaurants/[id]/route.ts`: expose and persist `isActive` in the admin path.
- Shared restaurant DTO/types/services: add `isActive` where needed so cache updates remain consistent.

## Data Flow & API Contracts

Endpoint: `GET /api/restaurants/:slug`
Response: active restaurant only; inactive rows return 404 via shared lookup.

Endpoint: `PATCH /api/ops/restaurants/:id`
Request: existing restaurant fields plus optional `isActive: boolean`
Response: restaurant payload including `isActive`

## UI/UX States

- Public inactive venue slugs resolve to existing not-found behavior.
- No new UI state is required for this task unless an existing ops screen already consumes `isActive`.

## Edge Cases

- Mixed-case or whitespace-padded slugs should still normalize before active checks.
- Ops detail/list payloads should continue working for inactive restaurants owned by staff/admin users.
- Default restaurant fallback must not promote an inactive venue.

## Testing Strategy

- Unit/integration:
- Extend public restaurants page tests to cover inactive slug behavior via the shared lookup mock.
- Add focused tests for shared restaurant list/lookup behavior if needed.
- Extend restaurant DTO/cache tests if `isActive` changes cache shapes.

## Rollout

- Feature flag: none
- Exposure: immediate once deployed
- Monitoring: verify `/restaurants/three-horseshoes` returns 404 in production after data update
- Kill-switch: restore `is_active = true` for the venue if rollback is required

## DB Change Plan (if applicable)

- Target envs: production data update after deploy
- Backup reference: n/a for a single-row boolean change
- Dry-run evidence: not yet captured in this task; Supabase MCP not available in this environment
- Backfill strategy: none
- Rollback plan: set `restaurants.is_active` back to `true` for Three Horseshoes
