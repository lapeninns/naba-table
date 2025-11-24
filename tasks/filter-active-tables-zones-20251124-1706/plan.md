---
task: filter-active-tables-zones
timestamp_utc: 2025-11-24T17:07:01Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Filter Active Tables & Zones

## Objective

Enable users to view only active (enabled) tables and zones by providing filters that hide disabled entries, reducing noise and preventing actions on inactive resources.

## Success Criteria

- [ ] UI provides a clear control to show/hide disabled tables and zones.
- [ ] Lists update instantly when the filter is toggled.
- [ ] Accessibility: controls are keyboard-focusable with labels; filtered counts remain accurate.

## Architecture & Components

- Reuse existing list components for tables/zones (to be identified in codebase).
- Add a shared filter control (toggle or segmented control) for active/all.
- State stored in page-level component; passed as prop to list rendering functions.
- If API supports, include query param `status=active` when fetching; otherwise filter client-side on `status`/`isActive` flags.

## Data Flow & API Contracts

- Status fields already present in UI data: `zone.active`, `table.active`, and `table.zoneActive` (true when the table's zone is active).
- Default behavior will filter client-side to active-only using these flags, with toggles to show inactive or all.
- If APIs later expose a `status` query param we can wire it, but current change is client-side only.
- Error handling: show existing empty/error states.

## UI/UX States

- Default view shows active zones/tables only; user can switch to inactive-only or all via filter controls.
- Empty state when no items for selected filter, with guidance to show all.
- Loading state unchanged.

## Edge Cases

- All items disabled → filter results empty; show empty state message.
- Mixed statuses; ensure counts and pagination (if any) remain correct after filter.
- Ensure bookmark/URL state? Decide whether to persist in query param if pattern exists.

## Testing Strategy

- Add unit/interaction test for filter toggle affecting rendered items.
- Verify a11y: focus order, aria-label on toggle.

## Rollout

- Feature flag not planned unless existing flag framework requires; consider `feat.ui.activeFilter` if needed.

## DB Change Plan

- Not applicable (UI-only; no migrations).
