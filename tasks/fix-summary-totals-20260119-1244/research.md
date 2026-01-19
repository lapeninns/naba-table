---
task: fix-summary-totals
timestamp_utc: 2026-01-19T12:44:09Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Refresh ops summary totals after table unassign

## Requirements

- Functional:
  - Summary totals stay accurate after table unassignment changes booking status (confirmed -> pending).
  - Non-realtime environments still reflect status changes without requiring realtime events.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No UI changes; no new PII handling.

## Existing Patterns & Reuse

- React Query cache updates in `src/hooks/ops/useOpsTableAssignments.ts`.
- Summary query invalidation in `invalidateCaches` helper.

## External Resources

- None.

## Constraints & Risks

- Must follow AGENTS SDLC phases and task artifacts.
- Avoid regressions in summary totals and heatmap caches.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Update summary totals in cache when booking status changes during unassign, or invalidate summary in non-realtime flows to guarantee refetch.
