---
task: perf-floor-plan-load
timestamp_utc: 2026-02-12T15:33:24Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: `/app/floor-plan` Takes 20-30s to Load

## Observations

`/app/floor-plan` renders a client component but is gated by two slow-to-resolve queries:

- `GET /api/ops/tables` (table inventory)
- `GET /api/ops/tables/timeline` (availability timeline)

Both endpoints hit remote Supabase (per policy) and perform auth + multiple DB reads.

## Likely Root Causes

- **Remote DB latency / heavy queries** (timeline builds schedule + loads bookings + holds + turn bands + tables).
- **Unnecessary work**: both tables endpoint and timeline builder compute summary data (service capacity summary) that floor plan does not consume.
- **Duplicate calls**: floor plan fetches several related resources on load; any single slow endpoint blocks the page.

## Recommended Direction

- Reduce endpoint work for floor plan by skipping summary computation where not used.
- Parallelize independent Supabase calls inside timeline builder to reduce sequential latency.
- Keep API invariants clean: opt-in query param (`includeSummary=0`) to preserve default behavior elsewhere.
