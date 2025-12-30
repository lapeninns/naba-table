---
task: floor-plan-revamp
timestamp_utc: 2025-12-30T17:42:41Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Floor Plan Revamp

## Objective

We will enable ops teams to manage floor availability, add bookings, and browse bookings from a redesigned floor plan that matches the dashboard/new‑bookings visual system on all devices.

## Success Criteria

- [ ] `/floor-plan` matches the dashboard/bookings/new‑bookings visual language using Shadcn primitives and app tokens.
- [ ] “Add booking” CTA routes to `/new-bookings` with contextual date/time/table params when available.
- [ ] “Browse bookings” routes to `/bookings` with contextual filters (date + table + time window) and a toggle for full-day vs windowed view.
- [ ] Floor plan works on mobile → desktop (canvas, inspector, controls).
- [ ] A11y and perf budgets pass with Chrome DevTools MCP artifacts.

## Architecture & Components

- `FloorPlanPage` (existing) restructured into clear sections:
  - `FloorPlanHeader` (title, date, key stats, primary CTAs)
  - `FloorPlanToolbar` (zone filter, time controls, status legend, search)
  - `FloorPlanCanvas` (table layout, status rendering, zoom/pan)
- `FloorPlanInspector` (table/booking details + upcoming bookings list; responsive as Sheet on small screens)
- `FloorPlanQuickActions` (Add booking / Browse bookings, contextual to selected table/time)
- Shadcn base components: `Card`, `Tabs`, `Tooltip`, `Popover`, `DropdownMenu`, `Badge`, `Sheet`, `Skeleton`, `Slider`, `Separator`, `Button`, `Input`.
- Motion: subtle transitions on selection, drawer, and zoom controls respecting `prefers-reduced-motion`.

## Data Flow & API Contracts

Endpoint(s):

- `GET /api/ops/tables`, `GET /api/ops/zones` for layout + metadata (existing).
- `GET /api/ops/bookings` for browsing bookings (existing `/bookings` page).
- `GET /api/ops/dashboard/*` or timeline hook for status snapshots (existing).

Add booking:

- Navigate to `/new-bookings` with `date`, `time`, and `tableId` query params if available.

Browse bookings:

- Navigate to `/bookings` with `date`, `tableId`, `time`, and `windowMode` (e.g., `day` | `window`) params (plus existing `query`/`statuses`).
- Extend `/bookings` search params parsing to include `tableId`, `time`, `windowMode`, and optional `windowMinutes` (default ±90 minutes).
- Add a UI toggle in bookings list to switch “All day” vs “Nearby time window.”
- Extend `useOpsBookingsList` filters to pass table/time to the API.

API changes (if needed):

- Add optional filters to `GET /api/ops/bookings` (e.g., `tableId`, `startAt`, `endAt`, `windowMinutes`).
- Resolve table ↔ booking relation via existing allocation tables (inspect `allocations`/table mapping used by timeline).
- Keep pagination, sorting, and query behavior intact; add filters as non-breaking optional params.

## UI/UX States

- Loading / Empty / Error / Success
- Offline: disable CTAs that require network; show toast.
- No positions: fallback to auto‑layout grid (existing behavior).
- Empty bookings: show “No bookings at this time” with CTA to open `/bookings`.

## Edge Cases

- Late‑night service hours crossing midnight.
- Many tables (performance + tap target density).
- Small screens: inspector becomes Sheet; toolbar collapses into menus.
- No active restaurant or missing zone assignments.
- Bookings list filtered by table/time returns empty while timeline shows activity (data mismatch).

## Testing Strategy

- Unit: new helper logic (if any) for layout or timeline mapping.
- Integration: floor plan interactions (selection, zoom/pan, CTA params, browse filters).
- E2E: ops routes (`/floor-plan`, `/bookings`, `/new-bookings`) and core flows.
- Accessibility: keyboard navigation, focus management, ARIA labels; axe clean.

## Rollout

- Feature flag: `feat.ops.floor_plan_revamp` (optional; use if rollout risk is high).
- Exposure: 10% → 50% → 100% (if flagged); otherwise replace existing UI.
- Monitoring: Sentry UI errors, ops booking conversion, time to seat.
- Kill-switch: disable flag to revert to previous UI (if implemented).

## DB Change Plan (if applicable)

- Target envs: N/A (no DB changes planned).
- Backup reference: N/A
- Dry-run evidence: N/A
- Backfill strategy: N/A
- Rollback plan: N/A
