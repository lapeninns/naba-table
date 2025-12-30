---
task: restore-floor-plan
timestamp_utc: 2025-12-30T17:11:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Restore Floor Plan (Sidebar + Route)

## Objective

We will restore the floor plan implementation from `main` into the current branch and surface it in the ops sidebar under "Daily operations" so ops can access the floor plan UI.

## Success Criteria

- [ ] Floor plan files match `main` for the agreed paths.
- [ ] Sidebar includes a "Floor Plan" item under "Daily operations".
- [ ] `/app/seating/floor-plan` renders without errors.
- [ ] No unrelated files are changed.
- [ ] Manual UI QA completed via Chrome DevTools MCP if UI changes are involved.

## Architecture & Components

- Restore `BookingAssignmentTabContent.tsx` from `main` (floor plan tab content).
- Update `BookingDialog.tsx` to render `BookingAssignmentTabContent` in the tables section.
- Move floor plan UI into a shared client component.
- Add `src/app/app/(app)/floor-plan/page.tsx` to render the shared component at `/floor-plan`.
- Update `src/app/app/(app)/seating/floor-plan/page.tsx` to redirect to `/floor-plan`.
- Restore `src/app/app/(app)/seating/page.tsx` and adjust redirect to `/floor-plan`.
- Update ops sidebar nav to include Floor Plan under Daily operations pointing to `/floor-plan`.

## Data Flow & API Contracts

- No API contract changes expected; continue using `getAssignmentContext` and direct assign/unassign.

## UI/UX States

- Preserve loading/empty/error states as in `main`.

## Edge Cases

- Conflicting local changes in unrelated files during restore.
- Missing dependencies if only partial restore is performed.

## Testing Strategy

- Targeted UI smoke and a11y checks for restored floor plan.

## Rollout

- No feature flag changes expected; confirm.

## DB Change Plan (if applicable)

- None expected.
