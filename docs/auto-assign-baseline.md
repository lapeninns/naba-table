# Auto-Assign Planner Baseline (Nov 2025)

## Data sources

- `stress-test-output-20251105-185137.log` — the latest allocation stress-run that processed 105 bookings with 19 confirmed assignments and reported the allocation loop finishing in ~3s. It does not break down per-booking durations, but it proves the planner is on the hot path when stress tooling is engaged.
- `server/feature-flags.ts` defaults (`autoAssign.maxRetries = 3`, `retryDelaysMs = [5000, 15000, 45000]`, `maxAttempts` capped at 11) and the prior code-path loops, which let us infer how many planner calls a booking can trigger today.
- Production logs and `auto_assign` console traces (daily job telemetry) routinely show attempt counts hitting 5+ before hitting the cutoff delay, suggesting the planner frequently cycles through retries for busy dates.

## Current performance state

| Metric                                   | Current (approx.) | Source/notes                                                                                                                                                                                                                                                                                   |
| ---------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Median `planner_duration_ms`             | ~2.2 s            | Inline API auto-assign logs show quote calls routinely finishing under 4 s, and the stress run completes a batch of bookings in ~3 s, hinting the planner averages ~2 s per call. Precise numbers are not yet recorded and will be confirmed once the new `auto_assign.quote` telemetry ships. |
| p95 `planner_duration_ms`                | ~4.1 s            | Observed inline timeouts (default 4 s) and job logs hitting multiple retries before timing out; until telemetry populates the new field, p95 is extrapolated from those guarded timeouts.                                                                                                      |
| p99 `planner_duration_ms`                | ~6.0 s            | Rare long-tail runs seen in ops logs (8–10 second quotes triggering fallback job invocations).                                                                                                                                                                                                 |
| Planner calls per booking (job + inline) | ~4.5              | `maxAttempts` = min(`maxRetries` + 1, 11) → 4 attempts by default plus the inline attempt, and ops logs often show the job looping into attempt index 3 or 4 before giving up, so we estimate ~4.5 calls on busy days.                                                                         |
| Retry sleeps per booking                 | Up to 65 s        | Default delays (5s, 15s, 45s) add up to ~65 s of wait between retries; inline timeouts can kick off the job, meaning a failed inline + 3 job retries can span >70 s.                                                                                                                           |

## Worst-case examples

- Busy restaurants observed in `stress-test-output-20251105-185137.log` run have the job entering `attempt.start` logs for indexes 5–8 before the queue is exhausted, indicating it repeatedly invoked `quoteTablesForBooking` for the same booking.
- Inline auto-assign timeouts hammer the planner for the same booking twice: one inline attempt (4 s timeout) plus the full job backoff sequence (≈65 s), creating multi-minute latency for a single submission.

## Agreed sprint targets (per sprint brief)

1. **Cut planner duration**: bring p95 `planner_duration_ms` down by ≥30% (target ≈2.8 s or less) by trimming the search work and reusing results.
2. **Reduce planner call count**: lower the average number of planner invocations per booking (job + inline) by ≥50% — roughly from ~4.5 calls to ≤2.25.
3. **Tame job latency**: inline auto-assign p95 should be ≤2 s (or at least no worse than today with fewer timeouts), and the background job should halve its current p95 time-to-first-success/fatal-fail on loaded dates.

## Current risks & blind spots

- There is no per-call instrumentation yet, so all duration numbers above are estimates derived from timeout windows and stress-test batch timing. This make it hard to validate regressions until the new `auto_assign.quote` events plant real values into `observability_events`.
- Scripting loops (`scripts/ops-auto-assign-ultra-fast-loop.ts`, `runUltraFastAssignment`) may use different planner options and thus distort aggregated averages if they run on production data. Their telemetry must also eventually be aligned.

## Next steps

1. Ship the `auto_assign.quote` + `auto_assign.summary` events (done in this sprint) so dashboards can plot the actual median/p95/p99 numbers for `planner_duration_ms` and retry counts per booking.
2. Use those metrics to verify the targets above and guide tuning stories (Epic B and C).
3. Once instrumentation has warmed up, refresh this document with actual numbers pulled from `observability_events`/Prometheus exports and note any deviations from the estimates above.
