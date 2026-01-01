---
task: ops-dashboard-header-rework
timestamp_utc: 2026-01-01T12:30:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Ops Dashboard Header Rework

## Requirements

- Functional:
  - Rework the Ops dashboard header UI so the service date block ("Service date" / "No bookings" / date) is clearer and more scannable.
  - Keep current functionality: date navigation buttons, HeatmapCalendar popover, and date selection.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Maintain semantic hierarchy and accessible labels.
  - Preserve responsive behavior across mobile/tablet/desktop.
  - No performance regressions (only layout/style changes).
  - Date strings may be long in some locales; layout must wrap gracefully.

## Existing Patterns & Reuse

- `src/components/features/dashboard/OpsDashboardClient.tsx` header structure: title + summary copy on left; date controls on right.
- `src/components/features/dashboard/HeatmapCalendar.tsx` renders "Service date", booking summary, and date picker button.
- `src/components/features/dashboard/DashboardSummaryCard.tsx` uses card header typography and spacing as a visual reference.
- `components/dashboard/BookingsHeader.tsx` shows a compact, scannable header layout and can inform spacing/typography.

## External Resources

- N/A (use existing design system and tokens).

## Constraints & Risks

- Use existing tokens/utilities (`bg-card`, `border-border`, `text-muted-foreground`, `font-sans`) and avoid custom inline styles.
- Shadcn components are already in use (Button, Card, Calendar, Popover); do not introduce new primitives unless needed.
- Risk: over-tightening layout could truncate long date strings; ensure wrap and min-width rules are safe.

## Open Questions (owner, due)

- Q: Do you want the service date block to show additional context (timezone, “Today”, etc.) beyond current content?
  A: (owner: github:@maintainers, due: 2026-01-01)
- Q: Confirm owner/reviewer handles for task frontmatter.
  A: (owner: github:@maintainers, due: 2026-01-01)

## Recommended Direction (with rationale)

- Restructure the date block into a clearer two-line stack with a stronger label and compact meta line, while keeping the date picker button prominent.
- Match spacing/typography to existing dashboard cards so the header reads as a deliberate control cluster, not floating text.
- Keep layout flexible for long locales by allowing wrap and using consistent gaps.
