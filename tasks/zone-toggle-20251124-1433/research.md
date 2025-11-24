---
task: zone-toggle
timestamp_utc: 2025-11-24T14:37:40Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Zone availability toggle for seating tables

## Requirements

- Functional:
  - Allow ops users on `/seating/tables` to mark a service zone (e.g., Garden) as active/inactive so seasonal areas can be removed from service without deleting zones or tables.
  - When a zone is inactive, tables inside it should not be offered/ counted in availability or capacity summaries and should be clearly indicated in the UI; re‑activating should restore them.
  - Zone state should be persisted (not per-session) and enforced server-side to keep availability logic consistent.
- Non-functional:
  - UI must stay keyboard accessible and respect existing a11y patterns (labels, focus, ARIA, visible focus).
  - Avoid breaking existing booking/tables APIs; safe defaults (existing zones default to active).
  - Keep backwards compatibility for clients until migration is applied (treat missing column as active true).

## Existing Patterns & Reuse

- Zones are managed via `TableInventoryClient` using `ZoneService` (`/api/zones`).
- Tables reference zones via `zone_id`; summary and filters already group tables per zone (`server/ops/tables.ts`, `TableInventoryService`).
- Table-level activation already exists (`table_inventory.active`), but there is no zone-level active flag.
- Types: `zones` table in `types/supabase.ts` currently has `name`, `sort_order`, `area_type` only—no active field.

## External Resources

- None needed beyond existing repo context.

## Constraints & Risks

- DB change required (add `active` boolean to `zones`). Must follow Supabase remote-only policy and include migration + rollback notes.
- Need to ensure capacity summaries and availability filters respect zone active state; otherwise inactive zones may still appear.
- Existing API consumers might not expect `active` field; must keep responses backward compatible.
- UI must show inactive zones distinctly and prevent assigning tables to inactive zones or at least warn.

## Open Questions (owner, due)

- Should inactive zones hide from table creation, or allow selection with warning? (assume allow selection but label, since tables may need to stay mapped) — owner: github:@amankumarshrestha, due: before rollout.
- Should bookings API exclude inactive zones when searching availability? (out of scope unless clarified; assume table availability already uses `table_inventory.active` and will need zone filter.)

## Recommended Direction (with rationale)

- Add `active boolean default true` to `zones` table; backfill existing rows to true and include rollback (drop column) plan.
- Extend zone service/API to read/write `active`; add PATCH to toggle.
- Update table listing & capacity summary to ignore inactive zones/tables when zone is inactive (filter out by joining zone.active).
- UI: add switch per zone card + badge in `/seating/tables`; allow filter to include inactive via label; disable assigning new tables to inactive zones with inline warning.
- Provide tests around API validation + server service filtering; add client-side regression via unit/RTL if present; manual QA via DevTools.
