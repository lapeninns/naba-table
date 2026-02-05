---
task: ops-dashboard-revamp
timestamp_utc: 2026-02-05T09:06:06Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Ops Dashboard Revamp

## Requirements

- Functional:
  - Bookings become the primary focus with filters/search inline above list.
  - Remove the overview panel entirely to reduce cognitive load.
  - Remove the heatmap from the dashboard experience.
  - De-emphasize visual stress in cards and filters.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve accessibility (keyboard navigation, contrast, aria).
  - No new dependencies or backend changes.

## Existing Patterns & Reuse

- Dashboard layout: `src/components/features/dashboard/OpsDashboardClient.tsx`.
- Bookings list + controls: `DashboardSummaryCard`, `BookingsList`, `BookingsListControls`.
- Ops toolbar/filter/search: `OpsDashboardToolbar` + `BookingsFilterBar`.

## External Resources

- SevenRooms operator patterns (public help reference). https://help.swiftpos.com.au/sevenrooms

## Constraints & Risks

- Avoid deep nesting; keep UI components readable.
- Collapsible sections must remain accessible and keyboard-friendly.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Single bookings-focused panel; remove overview entirely to reduce visual and cognitive load.
- Inline filters/search within bookings panel.
- Soften card visuals and urgency cues to lower stress.
