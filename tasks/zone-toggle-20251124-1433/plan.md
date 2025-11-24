---
task: zone-toggle
timestamp_utc: 2025-11-24T14:37:40Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Zone availability toggle for seating tables

## Objective

Enable ops users to activate/deactivate seating zones (e.g., Garden) so seasonal areas can be taken out of service without deleting tables, while keeping availability/capacity calculations accurate.

## Success Criteria

- [ ] Zones have a persisted `active` state (default true) configurable from `/seating/tables` UI.
- [ ] Inactive zones visually indicated and excluded from table capacity/summary cards by default.
- [ ] API rejects toggles without auth and returns updated zone payload including `active`.
- [ ] Manual QA confirms keyboard accessibility and no console errors across desktop/mobile widths.

## Architecture & Components

- Data model: add `active boolean default true` column to `zones` table.
- Server APIs: `src/app/api/zones` list/create/update to include `active`; validation adds optional boolean; `server/ops/zones.ts` to persist/read active.
- Tables service: `server/ops/tables.ts` & `src/services/ops/tables.ts` to filter out tables whose zone is inactive when computing summary/list; `TableInventoryService` may pass zone.active to client.
- Client services: `src/services/ops/zones.ts` map active; context provider unchanged.
- UI: `TableInventoryClient` zone list cards get toggle switch; badge for inactive; disable table form zone select when chosen zone inactive and show hint; filter dropdown marks inactive.

## Data Flow & API Contracts

- GET `/api/zones?restaurantId=uuid` → `{ zones: ZoneDto[] }` where ZoneDto includes `active`.
- PATCH `/api/zones/:id` accepts `{ name?, sortOrder?, active? }`; returns `{ zone }`.
- Table list endpoints `/api/ops/tables` should omit inactive zones from summaries and either exclude tables tied to inactive zones (preferred) or mark them inactive in payload so UI can dim them; plan: filter them out of `summary` counts but keep rows with `active=false` + `zone.active=false` for visibility and editing.

## UI/UX States

- Zone card shows switch (On/Off) with status badge (Active/Inactive) and helper text; toggling updates state with toast success/error.
- Table filter dropdown tags inactive zones with `(inactive)` and disables selection? (Allow selection but highlight to re-enable; keep consistent for editing existing tables.)
- Table rows display inactive zone badge and reduce opacity for clarity.
- Loading/empty/error states unchanged.

## Edge Cases

- Existing zones without active column default to true after migration.
- Attempting to delete inactive zone with tables still blocked (existing logic); ensure message still accurate.
- If toggle request fails, revert switch UI state and show toast.
- When zone inactive, new table creation prevents use? -> Show warning but allow (assumption until requirement clarified).

## Testing Strategy

- Unit/integration: add tests for `/api/zones` list/update validating `active`; adjust `server/ops/tables` summary filtering to ignore inactive zones in capacity counts.
- Client: basic React component test for zone toggle handler if feasible; otherwise rely on manual QA.
- Manual QA (DevTools MCP):
  - Toggle zone inactive → summary counts drop, tables dimmed; re-enable restores.
  - Keyboard: tab to switch, space/enter toggles; focus visible.
  - Mobile width check ~375px, desktop ≥1280px; no console errors.

## Rollout

- No feature flag (small, self-contained); ship with migration.
- Migration order: staging → production with backup reference noted; rollback by dropping column.
- Monitoring: watch error logs on `/api/zones` and booking availability if zone filtering touches table summary; add Sentry breadcrumb (existing infra).

## DB Change Plan

- Migration `supabase/migrations/20251124xxxxxx_add_zone_active.sql`:
  - `ALTER TABLE zones ADD COLUMN active boolean NOT NULL DEFAULT true;`
  - `UPDATE zones SET active = true WHERE active IS NULL;`
  - Index optional? not needed now.
- Rollback: drop column; ensure view/types regenerate.
