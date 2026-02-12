---
task: perf-floor-plan-load
timestamp_utc: 2026-02-12T15:33:24Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Checklist

- [x] Add `listTables` (no summary) to `server/ops/tables.ts`.
- [x] Add `includeSummary` query param handling to `/api/ops/tables`.
- [x] Add `includeSummary` query param handling to `/api/ops/tables/timeline`.
- [x] Parallelize timeline builder Supabase awaits.
- [x] Update floor plan client requests to pass `includeSummary=0`.
- [x] Floor plan UI: render once table layout is ready (don't block on timeline).
- [x] `npm run typecheck`
- [x] `npm run lint`
- [ ] Manual QA: floor plan still works; load time improved.
- [ ] Complete `verification.md`
