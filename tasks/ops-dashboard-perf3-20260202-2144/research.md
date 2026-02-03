---
task: ops-dashboard-perf3
timestamp_utc: 2026-02-02T21:44:20Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Ops Dashboard Additional Perf Improvements

## Requirements

- Implement remaining perf ideas: row height caching, realtime batching, DTO memo cache, search index, query select where applicable.
- Preserve behavior and a11y.
- No new deps unless necessary.

## Existing Patterns & Reuse

- Virtualized list in `BookingsList` using `useWindowVirtualizer`.
- Realtime updates in `useBookingRealtime`.
- Summary data via `useOpsTodaySummary` (React Query).

## Constraints & Risks

- Chrome DevTools MCP required for UI verification; env vars missing.

## Recommended Direction

- Add row measurement cache to virtualizer with `measureElement` and store per-id height in ref.
- Batch external update toasts to reduce per-event renders (debounce in hook).
- Add lightweight search index map per booking to avoid recompute.
- Cache DTOs by booking id + updatedAt/status fields.
- Use React Query `select` in summary hook if possible without breaking other consumers.
