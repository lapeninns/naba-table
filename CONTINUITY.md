# Continuity Ledger

Last updated: 2026-02-12T16:02:00Z

## Goal (incl. success criteria)

- Reduce perceived and actual load time for ops floor plan and ops app hard reloads.
- Success:
  - `/app/floor-plan` does not block UI rendering on timeline status (tables render as soon as inventory is available).
  - `/api/ops/tables` and `/api/ops/tables/timeline` can skip summary work via `includeSummary=0`.
  - `/app/*` hard reload avoids repeated membership lookups via a bounded TTL cache.

## Constraints/Assumptions

- Follow root AGENTS policies.
- Supabase access is remote-only; do not run local migrations.
- Manual UI QA via Chrome DevTools MCP is required for UI changes.
- Secrets must stay in env/secret stores; nothing should be committed.

## Key decisions

- Keep `includeSummary=0` as an opt-in toggle to preserve default API behavior for existing consumers.
- Use a small in-memory TTL cache for ops memberships keyed by `userId` (best-effort across requests within the same Node process).

## State

- Implemented performance improvements; remaining manual QA requires an authenticated ops session to measure real `/app/*` TTFB and API latencies against remote Supabase.

## Done

- Floor plan timeline drag no longer pans the canvas.
- Floor plan modularization/refactor completed (file size + a11y improvements).
- Fixed broken floor plan “New booking” / “Browse bookings” links to `/app/*`.
- Perf: added `includeSummary=0` fast-paths for tables + timeline and parallelized timeline builder awaits.
- Perf: updated floor plan to render once table layout is available (timeline loads in background).
- Perf: added ops membership TTL cache and switched ops layout + dashboard prefetch to use cached memberships.

## Now

- Awaiting authenticated manual QA on `/app/floor-plan` to confirm:
  - Reduced document TTFB on repeat reloads (membership cache hit).
  - Faster `/api/ops/tables?includeSummary=0` and `/api/ops/tables/timeline?includeSummary=0`.

## Next

- If TTFB remains high: optimize layout auth/membership resolution further (instrument timings; consider caching/column trimming elsewhere).
- If timeline endpoints remain slow: DB-level improvements (indexes, projection trimming, query consolidation) as a separate Supabase remote-only task.

## Open questions (UNCONFIRMED if needed)

- What deployment model is used for ops (serverless vs long-lived Node)? In-memory caches help most on long-lived instances.

## Working set (files/ids/commands)

- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/src/components/features/seating/FloorPlanPage.tsx
- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/server/ops/table-timeline.ts
- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/server/ops/tables.ts
- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/server/team/access.ts
- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/src/app/app/(app)/layout.tsx
- Task folders:
  - /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/tasks/perf-floor-plan-load-20260212-1533/
  - /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/tasks/perf-app-layout-memberships-20260212-1555/
