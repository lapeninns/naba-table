---
task: capacity-simplification
timestamp_utc: 2025-11-30T12:46:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: high
flags: []
related_tickets: []
---

# Research: Capacity flag simplification

## Requirements

- Delete/hardcode unused or experimental capacity flags per "Top 10 things to delete/hardcode first" (pipeline v3, allocator v1 toggles, retry policy v2, strategic config/scarcity, adjacency modes, hold rate limits, shadow/debug flags).
- Standardize on a single allocator path (v2) with no legacy/shadow/force toggles.
- Simplify selector scoring to a minimal heuristic (wasted seats + table-count cost) and drop dynamic scarcity/demand weights.
- Replace dynamic strategic config/demand-profile loading with static constants.
- Remove hold rate limiting/min-TTL configurability; set a single default TTL (target 180s) with holds enabled toggle retained.
- Reduce feature flag surface in env/schema and helper APIs to a small core set.

## Existing Patterns & Reuse

- Env parsing centralized in `lib/env.ts` and `config/env.schema.ts`; feature helpers live in `server/feature-flags.ts` and gate allocator/holds/selector logic.
- Allocation uses v2 orchestrator (`server/capacity/v2`) and table-assignment flows; no `v1` directory exists.
- Selector scoring is in `server/capacity/selector.ts` with weights from `server/capacity/policy.ts`; scarcity scores from `server/capacity/scarcity.ts`.
- Holds logic in `server/capacity/holds.ts` relies on feature-flag helpers for TTL and rate limiting.
- Strategic config/demand profile loader (`server/capacity/strategic-config.ts`) provides dynamic scarcity weight.

## Findings / Inventory

- Pipeline v3: no code or env flags present (`rg "pipeline_v3"` / `rg "PIPELINE"` in schema returned none).
- Allocator toggles: `lib/env.ts` defines `allocatorV2` (enabled/shadow/forceLegacy); helpers in `server/feature-flags.ts` gate orchestrator and table-assignment flows; `server/capacity/v2/orchestrator.ts` blocks when disabled/forceLegacy. No allocator v1 implementation found.
- Adjacency modes: env supports `FEATURE_ALLOCATOR_ADJACENCY_MODE` + min party size; `getAllocatorAdjacencyMode` used in `server/capacity/selector.ts` and `server/capacity/table-assignment/manual.ts`. Adjacency query undirected flag also present.
- Auto-assign retry policy v2: flag defined in env/schema; `server/jobs/auto-assign.ts` branches on `isAutoAssignRetryPolicyV2Enabled()` for planner cache use, retry heuristics, and inline skip behavior; planner cache flags tied to this path.
- Strategic/dynamic scarcity: `server/capacity/strategic-config.ts` loads scarcity weight (default 22) from env/DB; `policy.ts` uses `getStrategicScarcityWeight`; `scarcity.ts` computes table scarcity from DB or heuristics; selector scoring multiplies scarcity scores.
- Selector scoring complexity: metrics include overage, tableCount, fragmentation, zoneBalance, adjacencyCost, scarcityScore with weights from `policy.ts`; demand multiplier considered; ranking uses combination penalties.
- Holds rate/min TTL: `lib/env.ts` exposes configurable minTtlSeconds and rate limits; `server/capacity/holds.ts` enforces TTL via `getHoldMinTtlSeconds()` and per-user rate limiting via `getHoldRateWindowSeconds()/getHoldRateMaxPerBooking()`.
- Shadow/debug flags: `allocatorV2.shadow` path in orchestrator; `planner.cache.debugProfiling` from `DEBUG_CAPACITY_PROFILING`; analytics toggles `opsRejectionAnalytics`, `opsMetrics` remain; need decision to keep/trim.
- Policy per-restaurant loader absent: `policy.ts` only allows timezone override; no DB-configurable policies to remove.
- Verification methods used so far: `find . -name AGENTS.md` (only root), `rg` searches for allocator/retry/adjacency/scarcity/hold flags, manual review of `lib/env.ts`, `config/env.schema.ts`, `server/feature-flags.ts`, `server/capacity/selector.ts`, `strategic-config.ts`, `scarcity.ts`, `holds.ts`, `jobs/auto-assign.ts`, `capacity/v2/orchestrator.ts`.

## Constraints & Risks

- Touches env schema and feature helpers used across capacity flows; high regression risk for booking/assignment jobs.
- Simplified scoring may change seat selection outcomes; must ensure adjacency/merge constraints still enforced.
- Removing rate limiting could allow rapid hold creation; user accepts but note operational exposure.
- Strategic config removal affects policy hashing and drift detection; need to ensure downstream code tolerates static weight.
- Tests/fixtures may depend on removed flags; will require updates.

## Open Questions

- Default hold TTL target 180s: confirm no UI/workflow assumes current 60s minimum.
- Whether to keep ops metrics/rejection analytics toggles or hard-enable/remove; lacking product guidance.
- Planner cache fate if retry policy v2 is removed—disable entirely or leave as always-off.

## Recommended Direction

- Standardize allocator on v2: drop `allocatorV2` flag objects and shadow/forceLegacy paths; orchestrator/table-assignment should assume enabled.
- Collapse auto-assign retry to single strategy (current v1) with fixed delays `[5000, 15000, 45000]`; remove `FEATURE_AUTO_ASSIGN_RETRY_POLICY_V2` branches and planner-cache coupling.
- Replace strategic config & scarcity loaders with static constants (max overage, max tables, scarcity weight) and remove demand-profile/DB dependencies.
- Simplify selector scoring to wasted-seats plus table-count cost; delete fragmentation/zone/adjaCost/scarcity metrics and related tests.
- Hardcode adjacency mode to "connected" with no min-party override; keep `requireAdjacency` true; remove env flags and branching.
- Fix holds to a single TTL constant (180s) with holds toggle only; delete rate limiting and min TTL configurability.
- Prune shadow/debug and unused feature flags from env/schema/feature helpers, retaining core toggles (holds enabled, auto-assign on booking, combination planner, booking past time blocking, manual assignment session).
