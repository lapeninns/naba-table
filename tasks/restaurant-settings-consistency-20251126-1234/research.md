---
task: restaurant-settings-consistency
timestamp_utc: 2025-11-26T12:34:10Z
owner: github:@amankumarshrestha
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Research: Restaurant Settings Consistency

## Requirements

- Functional: Make all restaurant settings pages (profile, operating hours, service periods, occasions, tables) use a consistent page shell so headings, spacing, and sub‑navigation align. Fix the Tables view so it no longer stretches the full container differently from the other settings pages.
- Non-functional: Preserve auth gating and existing data flows; maintain accessibility (semantic headings, focus-visible, keyboard nav) and responsive layout.

## Existing Patterns & Reuse

- `/settings/restaurant/*` routes share `src/app/app/(app)/settings/restaurant/layout.tsx`, which centers content in a `max-w-5xl` column, shows the Settings/Restaurant header, and renders `RestaurantSettingsSubnav` followed by page content.
- Individual views render through `OpsRestaurantSettingsClient` in `src/components/features/restaurant-settings/OpsRestaurantSettingsClient.tsx`, which handles restaurant selection and per-view sections.
- Tables live at `/settings/tables` with its own page wrapper (`container mx-auto space-y-6 ...`) but already uses `RestaurantSettingsSubnav` and `TableInventoryClient`, so only the shell differs.

## External Resources

- N/A

## Constraints & Risks

- Route for Tables currently sits outside `/settings/restaurant`; changes should not break deep links or active-state detection in `RestaurantSettingsSubnav`.
- Need to avoid altering data logic in `TableInventoryClient`—only adjust layout/shell.

## Open Questions (owner, due)

- None noted; assume Tables should keep the current `/settings/tables` path while matching the shared shell.

## Recommended Direction (with rationale)

- Extract a reusable restaurant settings page shell that mirrors the existing `/settings/restaurant` layout (eyebrow, title, description, subnav placement, `max-w-5xl` width) and use it for all settings pages, including Tables.
- Swap the Tables page wrapper to the shared shell to align spacing and headings without touching table management logic.
