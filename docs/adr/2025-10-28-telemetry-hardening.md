# ADR 2025-10-28 — Planner Telemetry & Privacy Hardening

## Status

Accepted — Sprint 4 telemetry enrichment shipped.

## Context

- Selector telemetry reported candidate outcomes but lacked timing, planner configuration, or normalized diagnostics.
- Telemetry payloads risked carrying free-text names or email addresses from hold metadata or skip reasons.
- Prior sprints introduced canonical window semantics (`windowsOverlap`) and planner limits, but documentation lived only in tasks.
- CI linting covered `Date.parse` usage yet offered no protection against reintroducing ad-hoc overlap helpers.

## Decision

1. **Telemetry enrichment**
   - Auto-assign and quote flows capture high-resolution timings (planner, assignment, hold) using `performance.now()`.
   - Telemetry events include `plannerConfig` capturing kMax, bucket/evaluation limits, adjacency flags, and max overage.
   - `CandidateDiagnostics` now exposes `totals.enumerated` / `totals.accepted` alongside normalized skip buckets.

2. **Privacy guardrails**
   - Telemetry payloads pass through a sanitizer that redacts fields containing `name`/`email` keys and masks email addresses in free text.
   - Hold telemetry inherits the sanitizer to protect metadata such as `createdByName` or notes containing emails.

3. **Documentation & linting**
   - Added JSDoc explaining adjacency gating, zone locking, and planner fallbacks.
   - Authored this ADR to anchor the telemetry/time decisions.
   - Extended ESLint (server scope) to forbid custom `windowsOverlap` declarations outside `server/capacity/tables.ts`.
   - CI lint now covers `server` and `tests/server` folders; lint-staged enforces the same on commit.

## Consequences

- Observability dashboards can break down planner latency, configuration, and skip counts without schema spelunking.
- Telemetry payloads no longer leak operator names or guest emails, lowering privacy risk.
- Contributors have clear guidance on adjacency/zone semantics and a single overlap helper, with lint preventing regressions.
- Slight overhead from high-resolution timers is negligible (<1 ms per booking) but should be monitored in large batches.
