---
task: filter-active-tables-zones
timestamp_utc: 2025-11-24T17:07:01Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Filter Active Tables & Zones

## Requirements

- Functional:
  - UI must allow filtering lists of tables and zones to hide disabled entries and optionally show only active ones.
  - Filtering should work consistently across both lists (tables and zones) with active/disabled state.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Must be keyboard accessible; filters focusable and labeled.
  - Should not introduce noticeable performance lag on list rendering.
  - Follow existing i18n strategy (if present) for labels.

## Existing Patterns & Reuse

- Table & zone management lives in `src/components/features/tables/TableInventoryClient.tsx` with Shadcn `Select`/`Switch` components—can extend with additional filters.

## External Resources

- None yet.

## Constraints & Risks

- Need to ensure backend data includes active/disabled status and that UI state matches.
- Risk of inconsistent filtering between zones and tables if handled in separate components.

## Open Questions (owner, due)

- What are the exact data fields representing active/disabled for tables and zones? (owner: agent) — Answered: use `zone.active`, `table.active`, and `table.zoneActive`.
- Do lists already support client-side filtering or require API params? (owner: agent) — Current UI uses client-side data from list endpoints; no status query param today.

## Recommended Direction (with rationale)

- Reuse existing list components and add a filter toggle/dropdown to show/hide disabled items for both tables and zones.
- Prefer client-side filtering if data already loaded; otherwise add query param to fetch only active entries if supported.
