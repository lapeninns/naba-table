# Architecture

Architectural decisions, patterns discovered, and conventions.

---

## Floor Plan Read-Only Viewer

### Current Entry Points and Shared Structure

```
src/app/app/(app)/floor-plan/page.tsx
└── FloorPlanPage
    ├── current shell/header wiring
    ├── current filter toolbar
    ├── FloorCanvas
    ├── desktop details container
    └── mobile sheet details container
```

- `FloorPlanPage`, `FloorCanvas`, and `TableInspector` already exist and are the only places this mission should reshape the UI.
- The redirects under `/app/seating` and `/app/seating/floor-plan` already point to `/floor-plan` and should remain unchanged.

### Target Component Hierarchy (Post-Mission)

```
src/app/app/(app)/floor-plan/page.tsx
└── FloorPlanPage
    ├── OpsPageHeader (read-only context header)
    ├── OpsPageToolbar (zone, date, search controls)
    ├── FloorCanvas
    │   ├── legend + occupancy summary
    │   ├── zoom controls
    │   ├── table buttons
    │   └── TimeScrubber
    ├── desktop details panel
    │   └── TableInspector
    └── mobile sheet
        └── TableInspector
```

### Route Boundaries

- `src/app/app/(app)/floor-plan/page.tsx` is the canonical authenticated route.
- `src/app/app/(app)/seating/page.tsx` and `src/app/app/(app)/seating/floor-plan/page.tsx` redirect to `/floor-plan`.
- The redesign must stay inside the existing route structure; do not create alternate floor-plan pages.

### Data Flow

- `useOpsSession()` provides the active restaurant ID.
- `useTableInventoryService().list(..., { includeSummary: false })` provides the floor layout and physical table metadata.
- `useZoneService().list(...)` provides zone filter options.
- `useOpsOperatingHours`, `useOpsServicePeriods`, and `useOpsRestaurantDetails` define timeline bounds, slot snapping, and timezone context.
- `useOpsTableTimeline(...)` provides live occupancy status and refreshes through realtime invalidation or polling fallback.
- `useFloorPlanTimelineConfig(...)` converts operating-hours data into the valid scrubber range.
- `useFloorPlanTables(...)` is the canonical view-model merger for table inventory + timeline status.

### Core Invariants

- `FloorPlanPage` currently owns selection plus booking-navigation side effects; the target state for this mission is a pure orchestration component for filters, selection, and read-only layout with no booking navigation side effects.
- Selection is local UI state. Table activation only changes selection and details presentation.
- `selectedTable` is derived from `selectedTableId` plus the currently visible `filteredTables`; hidden tables must not show stale details.
- `useFloorPlanTables(...)` owns occupancy semantics:
  - `reserved` + `checked_in` => `seated`
  - `reserved` or `hold` => `reserved`
  - inactive / zone inactive / non-available / `out_of_service` => `closing` (user-facing “out of service”)
  - timeline loading => `loading` for otherwise-active tables
- Status styling should flow from `src/components/features/seating/floor-plan/lib/status.ts`; do not reintroduce one-off status color logic in page components.

### UI Responsibilities

- `FloorCanvas` already owns map interaction chrome, keyboard/pointer pan-zoom behavior, the time scrubber, the empty-search overlay, and rendering visible tables. This mission adds the read-only legend/summary treatment without moving those responsibilities elsewhere.
- `TableInspector` currently mixes passive facts with actions; the target state is a passive presenter for selected-table facts. Desktop and mobile use the same component with different containers.
- The header, legend, summary, and detail copy must all end this mission as informational-only; no booking creation, assignment, or booking-navigation actions belong on this surface.

### Validation Surface Notes

- Primary validation happens on authenticated `http://app.localhost:3000/floor-plan`.
- Fallback validation uses `http://localhost:3000/dev/ops-floor-plan` if auth/bootstrap becomes blocked.
