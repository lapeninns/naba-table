---
task: reset-floorplan
timestamp_utc: 2025-11-25T23:54:26Z
owner: github:@assistant
reviewers: [github:@assistant]
risk: medium
flags: []
related_tickets: []
---

# Research: Reset floorplan zones and tables

## Requirements

- Functional:
  - Remove existing zones/tables configuration and recreate zones with provided counts and movability attributes.
  - Ensure Bar zone is marked as drinks-only booking area.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve data integrity; avoid leaving stale references to removed zones/tables.
  - Follow existing patterns for floor plan/booking data storage and seeding.

## Existing Patterns & Reuse

- Supabase seed used for live/staging is `supabase/seeds/white-horse-service-periods.sql`; it:
  - Deletes/rewrites zones, allowed capacities, and `table_inventory` for restaurant slug `white-horse-pub-waterbeach`.
  - Currently defines zones `Main Bar`, `Dining Room`, `Garden` and inserts tables with `table_category` + `table_mobility` all set to `movable`.
- Global seed (`supabase/seed.sql`) also contains older default zones/tables but primary runtime seed appears to be the Waterbeach-specific file invoked via `supabase/utilities/init-seeds-waterbeach.sql`.
- Mobility enum supports `movable` and `fixed`; zone `area_type` enum supports `indoor`, `outdoor`, `covered`.

## External Resources

- None yet.

## Constraints & Risks

- Risk of destructive wipe impacting production/staging bookings if not scoped correctly.
- Need to confirm target environment (likely staging) and whether data wipe applies to DB seeds, fixtures, or live data.

## Open Questions (owner, due)

- Which environment should be updated (dev/staging/prod)?
- Is there a backup/rollback expectation for the wipe?
- Should we split "Main Dining 1" into separate indoor/outdoor zones to keep `area_type` aligned with seating preference filtering, or keep a single zone with table-level section labels?
- What table numbering/labels are preferred for the new layout (e.g., `MD1-I-01`, `MD1-O-01`, `MD2-01`, `BAR-01`)?
- How should "drinks-only" for Bar be enforced—category-only, or do we need booking-type gating in the allocator/UI?

## Recommended Direction (with rationale)

- Identify source of truth for zones/tables (DB tables, JSON seeds, or config files).
- Prepare migration/seed update to replace definitions atomically; avoid partial states.
- Mark Bar as drinks-only via existing schema fields (e.g., tags/type) or add metadata if absent.
