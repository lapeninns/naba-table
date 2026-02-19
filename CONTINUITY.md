# Continuity Ledger

Last updated: 2026-02-19T13:58:43Z

## Goal (incl. success criteria)

- Reduce noisy PostHog client exception volume while preserving actionable exception capture.
- Success:
  - Client-side telemetry reporting does not generate additional unhandled `fetch` rejections.
  - Recurring non-actionable `Object Not Found Matching Id:* MethodName:update, ParamCount:4` exceptions are filtered before PostHog ingestion.
  - Targeted lint/tests/typecheck pass.

## Constraints/Assumptions

- Follow root AGENTS SDLC artifacts flow.
- Keep a single canonical PostHog/client-error instrumentation path.
- No schema changes and no UI behavior changes in this patch.

## Key decisions

- Hardened `/api/client-error` reporter with explicit promise rejection handling (`fetch(...).catch(...)`).
- Added a dedicated suppression predicate in `lib/posthog/error-filter.ts` for the exact noisy exception signature only.
- Wired suppression through PostHog `before_send` in `lib/posthog/provider.tsx` (drop only matching `$exception` events; pass all others unchanged).
- Added browser debug state at `window.__srxPosthogSuppressionDebug` to track suppression counts and recent samples without reintroducing telemetry noise.
- Added focused unit coverage for suppress/non-suppress cases.

## State

- Patch + targeted checks completed locally.

## Done

- Created task folder `tasks/posthog-issue-noise-hardening-20260219-1314/` with SDLC docs.
- Updated:
  - `lib/monitoring/clientReporter.ts`
  - `lib/posthog/provider.tsx`
- Added:
  - `lib/posthog/error-filter.ts`
  - `tests/lib/posthog/error-filter.test.ts`
- Verification:
  - `pnpm exec eslint lib/posthog/provider.tsx lib/posthog/error-filter.ts lib/monitoring/clientReporter.ts tests/lib/posthog/error-filter.test.ts` passed.
  - `pnpm vitest tests/lib/posthog/error-filter.test.ts` passed (1 file, 7 tests).
  - `pnpm run typecheck` passed.

## Now

- Ready for deployment and PostHog issue-volume observation.

## Next

- Confirm the filtered exception fingerprint trend drops after deploy.
- Recheck if `/auth` `Failed to fetch` exceptions continue after reporter hardening.

## Open questions (UNCONFIRMED if needed)

- Should any additional suppression be introduced, or keep current filter intentionally narrow?

## Working set (files/ids/commands)

- `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/lib/monitoring/clientReporter.ts`
- `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/lib/posthog/provider.tsx`
- `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/lib/posthog/error-filter.ts`
- `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/tests/lib/posthog/error-filter.test.ts`
- `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/tasks/posthog-issue-noise-hardening-20260219-1314/research.md`
- `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/tasks/posthog-issue-noise-hardening-20260219-1314/plan.md`
- `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/tasks/posthog-issue-noise-hardening-20260219-1314/todo.md`
- `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/tasks/posthog-issue-noise-hardening-20260219-1314/verification.md`

---

## Previous entry

Last updated: 2026-02-16T18:58:00Z

## Goal (incl. success criteria)

- Improve auto-assign reliability for ambiguous `hard.no_tables` outcomes.
- Success:
  - Async auto-assign does not hard-stop on the first `hard.no_tables`/`hard.no_suitable_tables` result.
  - A follow-up attempt is guaranteed even when computed max attempts would otherwise be 1.
  - Failed quote responses carry planner stats in production so observability includes filter-stage evidence.

## Constraints/Assumptions

- Follow root AGENTS SDLC artifacts flow.
- Keep retry behavior bounded and deterministic.
- No schema changes and no UI changes in this patch.

## Key decisions

- Added explicit retry policy helper in `server/jobs/auto-assign-retry-policy.ts`.
- Deferred hard-stop exactly once (attempt index 0) for:
  - `hard.no_tables`
  - `hard.no_suitable_tables`
- Kept immediate hard-stop for all other hard failure codes.
- Added `auto_assign.hard_stop_deferred` observability event for transparent runtime decisions.
- Updated quote behavior to always attach planner stats for failure results (success remains debug-flag gated).

## State

- Patch + tests completed locally.

## Done

- Created task folder `tasks/auto-assign-no-tables-retry-guard-20260216-1854/` with SDLC docs.
- Implemented retry policy helper and integrated it in:
  - `server/jobs/auto-assign.ts`
  - `server/jobs/auto-assign-retry-policy.ts`
- Updated planner stats attachment behavior in:
  - `server/capacity/table-assignment/quote.ts`
- Added tests:
  - `tests/server/jobs/auto-assign-retry-policy.test.ts`
- Verification:
  - `pnpm vitest tests/server/jobs/auto-assign-retry-policy.test.ts tests/server/capacity/planner-reason.test.ts` passed.
  - `pnpm exec eslint server/jobs/auto-assign.ts server/jobs/auto-assign-retry-policy.ts server/capacity/table-assignment/quote.ts tests/server/jobs/auto-assign-retry-policy.test.ts` passed.
  - `pnpm run typecheck` passed.

## Now

- Ready for runtime validation in production telemetry.

## Next

- Monitor `auto_assign.hard_stop_deferred` events for frequency and outcomes.
- Validate whether deferred retries reduce pending bookings caused by one-shot `hard.no_tables` outcomes.

## Open questions (UNCONFIRMED if needed)

- Should inline auto-assign also adopt the same defer-once policy, or remain single-shot by design?

## Working set (files/ids/commands)

- `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/server/jobs/auto-assign.ts`
- `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/server/jobs/auto-assign-retry-policy.ts`
- `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/server/capacity/table-assignment/quote.ts`
- `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/tests/server/jobs/auto-assign-retry-policy.test.ts`
- `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/tasks/auto-assign-no-tables-retry-guard-20260216-1854/research.md`
- `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/tasks/auto-assign-no-tables-retry-guard-20260216-1854/plan.md`
- `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/tasks/auto-assign-no-tables-retry-guard-20260216-1854/todo.md`
- `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/tasks/auto-assign-no-tables-retry-guard-20260216-1854/verification.md`

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
