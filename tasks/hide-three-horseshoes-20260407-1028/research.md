---
task: hide-three-horseshoes
timestamp_utc: 2026-04-07T10:28:00Z
owner: github:@OpenAI
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Hide Three Horseshoes From Production

## Requirements

- Functional:
- Prevent the public production route `/restaurants/three-horseshoes` from being reachable.
- Ensure the restaurant cannot still be booked through the public slug-based booking flow.
- Support marking the restaurant inactive through the canonical restaurant model rather than a one-off hide-only patch.
- Non-functional (a11y, perf, security, privacy, i18n):
- Keep the implementation focused and use existing restaurant state instead of adding a parallel visibility system.
- Preserve stable 404 behavior for inactive restaurants across public pages and APIs.

## Existing Patterns & Reuse

- Public restaurant detail, booking, schedule, and calendar-mask endpoints all resolve a venue through `server/restaurants/getRestaurantBySlug.ts`.
- Public restaurant listing uses `server/restaurants/listRestaurants.ts`.
- The `restaurants` table already has a first-class `is_active` column in `types/supabase.ts`.
- Ops restaurant update flows already use `src/app/api/ops/restaurants/[id]/route.ts`, `src/app/api/ops/restaurants/schema.ts`, and `server/restaurants/update.ts`.

## External Resources

- None required. This is an internal product-state change using an existing database field.

## Constraints & Risks

- Public readers currently ignore `restaurants.is_active`, so toggling the flag in data alone may not fully hide the venue.
- Default-restaurant fallback should not accidentally resolve to an inactive venue.
- A production data change may still be needed after code lands if Three Horseshoes is currently active in the remote database.

## Open Questions (owner, due)

- Q: Is there a separate subscription system that should own this state instead of `restaurants.is_active`?
  A: Current repo search did not reveal a first-class subscription/billing domain. Owner: agent. Due: implementation.

## Recommended Direction (with rationale)

- Treat `restaurants.is_active` as the canonical source of truth for public visibility.
- Update shared restaurant lookup/list code so inactive restaurants are excluded from public marketing and booking surfaces.
- Extend ops restaurant update contracts to carry `isActive`, so production can be switched off cleanly without a special-case code path.
