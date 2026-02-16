---
task: auto-assign-no-tables-retry-guard
timestamp_utc: 2026-02-16T18:54:56Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Reduce False-Negative `hard.no_tables` Stops

## Requirements

- Functional:
  - Prevent auto-assign from terminating after a single `hard.no_tables` / `hard.no_suitable_tables` outcome when a second attempt could recover.
  - Preserve deterministic hard-stop behavior for truly terminal hard failures.
  - Improve diagnostics so future incidents include planner filter evidence on failed quotes.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No schema changes.
  - No secret exposure.
  - Minimal runtime overhead in booking path.

## Existing Patterns & Reuse

- Hard/soft reason classification is centralized in `server/capacity/planner-reason.ts`.
- Auto-assign retry loop and stop conditions live in `server/jobs/auto-assign.ts`.
- Planner failure telemetry is emitted through `recordPlannerQuoteTelemetry` and includes optional `internalStats`.
- Planner internal stats are currently attached to quote results only when debug profiling is enabled in `server/capacity/table-assignment/quote.ts`.

## Constraints & Risks

- Over-retrying can increase load and duplicate work; retry policy must be bounded.
- Changing stop policy must not regress truly terminal failure handling.
- Telemetry payload size should remain compact.

## Open Questions (owner, due)

- Q: Should this policy apply to inline auto-assign too?
  A: Not in this patch. Inline remains single-shot; this change targets async job reliability and post-inline recovery.

## Recommended Direction (with rationale)

1. Introduce an explicit retry policy helper for hard failures:
   - Defer hard-stop once (attempt 0 only) for `hard.no_tables` and `hard.no_suitable_tables`.
   - Keep hard-stop immediate for all other hard codes.
2. Ensure deferred hard-stop actually runs a second attempt even when computed max attempts is 1.
3. Always attach planner stats to failed quote results so telemetry captures filter-stage evidence in production failures.

This keeps deterministic failures strict while reducing one-shot false-negative lock-in for no-table outcomes.
