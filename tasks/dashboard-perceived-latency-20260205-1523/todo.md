---
task: dashboard-perceived-latency
timestamp_utc: 2026-02-05T15:23:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create `useMinimumDelay` hook with delay + minimum duration.

## Core

- [x] Gate summary skeleton in `OpsDashboardClient`.
- [x] Delay refresh indicators in `OpsDashboardHeader` and `BookingsListControls`.
- [x] Delay heatmap loading state in `HeatmapCalendar`.
- [x] Delay booking details skeleton in `BookingDetailsDialogWrapper`.
- [x] Delay booking card action overlay in `OpsBookingCard`.
- [x] Freeze list sorting while lifecycle action pending.

## UI/UX

- [x] Add motion-safe fade-in on summary content mount.
- [x] Ensure aria-busy/status indicators remain correct.

## Tests & QA

- [x] `pnpm typecheck`
- [x] `pnpm build`
- [x] Chrome DevTools MCP QA on `/app/dashboard` (auth redirect)

## Notes

- Assumptions: Use existing skeleton components; no API changes.
- Deviations: Dashboard QA blocked by auth; captured redirect screenshot.
