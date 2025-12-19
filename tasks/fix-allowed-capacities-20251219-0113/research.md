---
task: fix-allowed-capacities
timestamp_utc: 2025-12-19T01:15:31Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Remove allowed_capacities writes after schema drop

## Requirements

- Functional: Table create/update must no longer attempt to write to `public.allowed_capacities` once the table is dropped.
- Non-functional: Avoid runtime 500s; keep changes minimal and aligned with removal of seating/capacity features.

## Existing Patterns & Reuse

- Table create/update endpoints call `ensureAllowedCapacity` from `server/ops/tables.ts`.
- No other usage of `allowed_capacities` in current codebase (per search).

## External Resources

- None. Low-risk internal change; MCP research not applicable.

## Constraints & Risks

- Migration `20251219002800_remove_seating_floorplan_capacity.sql` drops `public.allowed_capacities`.
- Leaving writes to the dropped table will cause runtime errors on table create/update.

## Open Questions (owner, due)

- Q: Should we also remove legacy `allowedCapacities` service file or leave for now?
  A: Default to minimal fix unless maintainers request cleanup.

## Recommended Direction (with rationale)

- Remove `ensureAllowedCapacity` usage in ops table create/update flows (and optionally remove the helper if unused).
- This aligns server behavior with the migration and prevents runtime 500s.
