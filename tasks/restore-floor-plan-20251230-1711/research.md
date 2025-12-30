---
task: restore-floor-plan
timestamp_utc: 2025-12-30T17:11:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Restore Floor Plan (Sidebar + Route)

## Requirements

- Functional: Restore the floor plan feature from `main` into the current branch for the agreed files/paths, surface it in the ops sidebar under "Daily operations," and ensure the URL always resolves to `/floor-plan` (redirect from `/seating/floor-plan`).
- Non-functional (a11y, perf, security, privacy, i18n): Preserve existing a11y behaviors; no regressions in performance or security.

## Existing Patterns & Reuse

- `src/components/features/dashboard/TableFloorPlan.tsx` exists and matches `main`.
- `src/components/features/dashboard/booking-details/BookingAssignmentTabContent.tsx` exists in `main` and wires TableFloorPlan + manual assignment UI.
- Current branch uses `BookingDialog.tsx` with `TableAssignmentPanel` (grid) instead of floor plan.
- `src/components/features/ops-shell/navigation.tsx` defines "Daily operations" sidebar section; `main` includes Seating section with Floor Plan route.
- `main` includes `src/app/app/(app)/seating/floor-plan/page.tsx` and `src/app/app/(app)/seating/page.tsx` (redirect).

## External Resources

- N/A

## Constraints & Risks

- Working tree currently has uncommitted changes; restore must not override unrelated work.
- Floor plan scope is not fully confirmed; risk of missing/over-restoring files.
- `main` seating index redirects to `/seating/floor-plan` (no `/app` prefix); may need adjustment in this branch.

## Open Questions (owner, due)

- Which exact files/paths are the "floor plan"? (owner: github:@maintainers, due: 2025-12-30)
- Restore only UI components or also data/config/assets? (owner: github:@maintainers, due: 2025-12-30)
- Confirm source branch: `main` (current) or different? (owner: github:@maintainers, due: 2025-12-30)

## Recommended Direction (with rationale)

- Inventory all floor plan related files and restore only those from `main` to avoid unrelated diffs.
