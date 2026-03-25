---
task: clone-old-school-house-production
timestamp_utc: 2026-03-25T16:08:31Z
owner: github:@openai
reviewers: [github:@openai]
risk: high
flags: []
related_tickets: []
---

# Research: Clone The Old School House from The Old Crown Girton in production

## Requirements

- Functional:
  - Create a new production restaurant for The Old School House.
  - Use The Old Crown Girton as the source template for restaurant-scoped configuration.
  - Apply The Old School House profile details and weekly trading hours.
- Non-functional:
  - Production-safe execution with explicit confirmation guards.
  - Do not copy live operational data like bookings or customers.

## Existing Patterns & Reuse

- Existing guarded production scripts:
  - `scripts/update-railway-details.ts`
  - `scripts/update-railway-zones-tables.ts`
  - `scripts/grant-restaurant-access.ts`
- Canonical create path:
  - `server/restaurants/create.ts`

## External Resources

- None. Production source data and local repo code were sufficient.

## Constraints & Risks

- High-stakes production write.
- Source has one dated `restaurant_operating_hours` override that should not be copied.
- Source has no restaurant-specific turn bands, so target should also start without custom turn bands.
- Source membership is `manager`, not `owner`; copying no memberships at all would leave the restaurant inaccessible in ops.

## Open Questions (owner, due)

- None. User confirmed proceeding with configuration-copy scope.

## Recommended Direction (with rationale)

- Create a guarded script that:
  - reads source config
  - creates the target restaurant
  - copies restaurant-scoped weekly configuration and table graph
  - applies target-specific profile and hours overrides
  - grants the same source membership(s) to keep the target manageable
- This is safer and more auditable than manual SQL.
