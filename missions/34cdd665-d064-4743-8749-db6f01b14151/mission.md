# Floor plan read-only redesign

## Plan Overview

Redesign `/floor-plan` into a strict read-only, map-first occupancy viewer while preserving the existing route structure, redirects, data sources, filtering, timeline semantics, keyboard pan/zoom behavior, and empty-search handling. The canonical implementation stays in `src/components/features/seating/FloorPlanPage.tsx`; there will be no alternate route or duplicated implementation.

## Expected Functionality

### Milestone: floor-plan-readonly-redesign

- Remove booking creation, assignment, and booking-navigation actions from the page surface.
- Rework `FloorPlanPage` into a lighter context header, hero floor canvas, and read-only selected-table details layout.
- Update `FloorCanvas` to feel like an occupancy board with status legend, summary counts, and lower-chrome controls while keeping pan/zoom and time scrubbing intact.
- Convert `TableInspector` into a passive presenter for table number, status, capacity, zone, seating type, current party, and timing.
- Keep zone/date/search/time controls working exactly as they do now for visible canvas state.
- Centralize status styling through the existing floor-plan status helpers instead of scattered ad hoc color classes.
- Add focused tests proving the read-only contract and extend `useFloorPlanTables` coverage for occupancy semantics.

## Environment Setup

- Task artifacts initialized at `tasks/floor-plan-readonly-redesign-20260403-1319/`.
- Local validation path confirmed with `pnpm validate:env` and `pnpm dev`.
- No API, database, or schema changes are required.

## Infrastructure

**Services / Processes**

- Next.js app via `pnpm dev` on port `3000`
- Primary validation surface: `http://app.localhost:3000/floor-plan`
- Fallback validation surface: `http://localhost:3000/dev/ops-floor-plan`

**Existing occupied ports to avoid**

- `5000`, `7000`, `8317-8319`, `54621`

**Boundaries**

- Do not change route behavior for `/floor-plan`, `/app/seating`, or `/app/seating/floor-plan` beyond preserving the existing redirects.
- Do not introduce new booking/assignment mutations, backend changes, or duplicate floor-plan implementations.
- Keep data access in existing hooks/services; feature components remain presentation/orchestration focused.

## Testing Strategy

- Unit/component tests for `FloorPlanPage`, `FloorCanvas`, `TableInspector`, and related read-only UI contracts.
- Extend `useFloorPlanTables` tests for reserved / seated / available / loading / closing semantics.
- Run lint, typecheck, and focused test commands for the touched floor-plan files before completion.

## User Testing Strategy

- Validate the authenticated route `http://app.localhost:3000/floor-plan` after signing in with the documented ops credentials.
- Use the existing `/dev/ops-floor-plan` harness only if auth/bootstrap becomes blocked.
- Verify on desktop and mobile: no mutation controls remain, selection opens/closes correctly, keyboard pan/zoom still works, and the responsive inspector/sheet remains accessible.

## Validation Readiness

- Dry run completed successfully: `app.localhost` resolves locally, auth bootstrap works, `/floor-plan` loads after sign-in, and the dev harness is reachable.
- Recommended browser-validation concurrency: up to 5 validators on this machine (64 GB RAM / 18 CPU cores, with the dry run showing modest overhead and one shared dev server).

## Non-Functional Requirements

- Maintain accessibility, visible focus, semantic status presentation, and responsive behavior.
- Keep the UX calm and map-first with reduced visual clutter.
- Preserve current occupancy semantics and live timeline behavior without API/data-contract changes.
