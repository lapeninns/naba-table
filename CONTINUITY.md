# Continuity Ledger

Last updated: 2026-02-16T10:53:00Z

## Goal (incl. success criteria)

- Debug why `ebrain@doctors.org.uk` did not get table assignment in production (Old Crown Girton), with evidence from Supabase and telemetry.
- Success:
  - Identify exact booking row and assignment timeline.
  - Confirm failure stage in auto-assignment path.
  - Provide evidence-backed root cause and remediation options.

## Constraints/Assumptions

- Follow root AGENTS SDLC task-artifact workflow.
- Production investigation remains read-only (no write/migration actions).
- PostHog MCP is currently unavailable in-session; fallback telemetry comes from `observability_events`.

## Key decisions

- Use production env file `.env.vercel-production.live` with explicit ref guard (`vrdiqfudmwydclqpydee`) to avoid accidental staging queries.
- Treat `booking_table_assignments` row absence on completed bookings as expected because checkout/no-show flows call `clearBookingTableAssignments`.
- Use audit + observability correlation as source of truth for historical assignment lifecycle.

## State

- Diagnosis plus follow-up hardening complete. Remaining risk around false capacity denials is reduced in canonical planner/filter/cache code paths, and Vercel deployment blockers found in logs are now patched.

## Done

- Created task folder `tasks/debug-old-crown-missing-assignment-ebr-20260216-0105/` with SDLC docs and evidence artifacts.
- Confirmed target booking and venue in production:
  - Booking `160681eb-ca50-4a52-90d3-4e4e2f12f3d2` (`FP9SWA7D24`)
  - Restaurant `The Old Crown Girton` (`a050d1ad-1ee0-4ea0-abc2-22c3778aa52c`)
- Captured observability timeline:
  - `inline_auto_assign.no_hold` + `auto_assign.failed` with reason `Insufficient filtered capacity`
  - `auto_assign.summary` result `exhausted`, `maxAttempts=1`
- Captured assignment audit timeline:
  - Manual assignment at `2026-02-15T11:48:27Z` to table `05` by `oldcrown@lapeninns.com`
  - Unassignment at checkout `2026-02-15T17:13:16Z`
- Implemented patch set:
  - `server/capacity/planner-reason.ts`: classify `Insufficient filtered capacity` as `hard.insufficient_filtered_capacity`.
  - `server/capacity/table-assignment/availability.ts`: use window-aware status policy (`available_only` near-now, `exclude_out_of_service` for future windows) and emit filter diagnostics.
  - `server/capacity/table-assignment/quote.ts` + `server/capacity/table-assignment/types.ts` + `server/capacity/planner-telemetry.ts`: carry filter diagnostics into `plannerStats`/observability.
- Implemented additional hardening for similar failure modes:
  - `server/capacity/table-assignment/availability.ts`: derive mergeability from `deriveTableRules` (legacy mobility-safe) and require adjacency metadata only for merge candidates (single-table fits no longer dropped for missing adjacency edges).
  - `server/capacity/selector.ts`: derive fallback reason from diagnostics to surface transient timeout/evaluation-limit outcomes instead of always collapsing to deterministic no-table reason.
  - `server/capacity/planner-reason.ts`: classify `evaluation limit` failures as transient (`transient.evaluation_limit`).
  - `server/capacity/planner-cache.ts` + `server/jobs/auto-assign.ts`: include `booking_type` in planner cache key to avoid cross-option cache collisions.
- Added regression tests:
  - `tests/server/capacity/planner-reason.test.ts`
  - `tests/server/capacity/availability-status-policy.test.ts`
  - `tests/server/capacity/selector-fallback-reason.test.ts`
  - `tests/server/capacity/planner-cache-key.test.ts`
- Investigated Vercel production deployment errors via CLI:
  - `vercel inspect nabatable-6chdx9fwg-lapen-inns-projects.vercel.app --logs`
  - `vercel inspect nabatable-jru8fk5a9-lapen-inns-projects.vercel.app --logs`
  - Confirmed common failure signature: `./lib/posthog/provider.tsx:78:20` (`string | null` passed to `posthog.init`).
- Patched deployment blockers:
  - `lib/posthog/provider.tsx`: explicit non-null key/host narrowing before `posthog.init`.
  - `tasks/booking-confirmation-pdf-template-20260212-1831/artifacts/pdf-template-smoke.ts`: null-safe venue-name check to restore branch-wide typecheck/build.
- Verification:
  - `pnpm vitest tests/server/capacity/planner-reason.test.ts tests/server/capacity/availability-status-policy.test.ts tests/server/capacity/selector-fallback-reason.test.ts tests/server/capacity/planner-cache-key.test.ts tests/server/capacity/selector-merge-policy.test.ts` passed (15 tests).
  - `pnpm exec eslint ...` on touched files passed.
  - `pnpm run build` passed.
  - `pnpm run typecheck` passed.

## Now

- Handoff complete patch set and verification evidence to user.

## Next

- Optional: trigger a new production deployment and verify no recurrence of the `lib/posthog/provider.tsx` TypeScript failure in Vercel build logs.
- Optional: monitor production `auto_assign.quote` events for increased `hard.insufficient_filtered_capacity` signal quality and new filter diagnostics.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/tasks/debug-old-crown-missing-assignment-ebr-20260216-0105/research.md`
- `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/tasks/debug-old-crown-missing-assignment-ebr-20260216-0105/plan.md`
- `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/tasks/debug-old-crown-missing-assignment-ebr-20260216-0105/todo.md`
- `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/tasks/debug-old-crown-missing-assignment-ebr-20260216-0105/verification.md`
- `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/tasks/debug-old-crown-missing-assignment-ebr-20260216-0105/artifacts/incident-timeline.md`
- `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/server/capacity/planner-reason.ts`
- `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/server/capacity/table-assignment/availability.ts`
- `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/server/capacity/table-assignment/quote.ts`
- `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/server/capacity/selector.ts`
- `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/server/capacity/planner-cache.ts`
- `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/server/jobs/auto-assign.ts`
- `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/tests/server/capacity/selector-fallback-reason.test.ts`
- `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/tests/server/capacity/planner-cache-key.test.ts`

---

## Previous entry

Last updated: 2026-02-12T16:02:00Z

## Goal (incl. success criteria) (previous)

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

---

## Previous entry

Last updated: 2026-02-11T23:59:00Z

## Goal (incl. success criteria)

- Incorporate OpenAI shell tooling guidance into root policy with concrete runtime/security controls.
- Success: add canonical shell runtime section + checklist gates in `AGENTS.md`, with SDLC artifacts captured.

## Constraints/Assumptions

- Follow root AGENTS policies and any closer AGENTS.md files for touched paths.
- Supabase operations must be remote-only.
- No secrets in logs or code.
- Keep changes documentation-only and scoped to workflow policy.

## Key decisions

- Added `8.6 Skills + Shell Execution Practices` to root `AGENTS.md`.
- Added a `Skills + Shell Execution` checklist block in Quick Reference.
- Kept `tmux` guidance optional (recommended when available), not mandatory.
- Added `8.7 Shell Tool Runtime & Security Policy` to root `AGENTS.md`.
- Added `Shell Tool Runtime` checklist block in Quick Reference.
- Adopted explicit policy for hosted/local runtime selection, `/mnt/data`, `network_policy`, `domain_secrets`, and multi-turn shell continuity.

## State

- Documentation policy update complete; no runtime code paths changed.

## Done

- Created task folder `tasks/skills-shell-workflow-20260211-2347/` with required SDLC artifacts.
- Extracted 10 recommendations from the OpenAI article and evaluated repo fit in `research.md`.
- Updated root `AGENTS.md` with a new section `8.6 Skills + Shell Execution Practices`.
- Updated root `AGENTS.md` Quick Reference with `Skills + Shell Execution` checklist.
- Updated task verification/todo artifacts to reflect completed policy changes.
- Created task folder `tasks/shell-tool-runtime-policy-20260211-2356/` with required SDLC artifacts.
- Verified OpenAI Shell guide controls and mapped policy gaps.
- Updated root `AGENTS.md` with `8.7 Shell Tool Runtime & Security Policy`.
- Updated root `AGENTS.md` Quick Reference with `Shell Tool Runtime` checklist.
- Updated task verification/todo artifacts for `shell-tool-runtime-policy`.

## Now

- Final review and user handoff.

## Next

- Use `8.6` + `8.7` as baseline for all future shell-heavy workflows.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- `AGENTS.md`
- `CONTINUITY.md`
- `tasks/skills-shell-workflow-20260211-2347/research.md`
- `tasks/skills-shell-workflow-20260211-2347/plan.md`
- `tasks/skills-shell-workflow-20260211-2347/todo.md`
- `tasks/skills-shell-workflow-20260211-2347/verification.md`
- `tasks/shell-tool-runtime-policy-20260211-2356/research.md`
- `tasks/shell-tool-runtime-policy-20260211-2356/plan.md`
- `tasks/shell-tool-runtime-policy-20260211-2356/todo.md`
- `tasks/shell-tool-runtime-policy-20260211-2356/verification.md`
