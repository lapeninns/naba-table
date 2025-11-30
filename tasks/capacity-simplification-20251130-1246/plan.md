---
task: capacity-simplification
timestamp_utc: 2025-11-30T12:46:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: high
flags: []
related_tickets: []
---

# Implementation Plan: Capacity flag and scoring simplification

## Objective

Standardize capacity allocation on a single allocator/selector path and delete unused feature toggles, strategic configs, and rate-limit plumbing to reduce complexity while keeping core booking/hold flows working.

## Success Criteria

- Env/schema compile with only the slimmed set of feature flags; runtime env validation passes.
- Allocator/table-assignment paths run without `allocatorV2` gating or shadow/legacy branches.
- Selector scoring uses the simplified heuristic and no longer depends on strategic scarcity or DB demand profiles.
- Holds creation uses a fixed TTL (target 180s) without rate limiting/min-TTL flags.
- Auto-assign job uses a single retry policy with fixed delays; no `retryPolicyV2` branches remain.
- Tests and linters pass for touched modules.

## Architecture & Components

- `config/env.schema.ts`, `lib/env.ts`, `server/feature-flags.ts`: shrink flag surface, hardcode allocator/adjacency/holds defaults.
- `server/capacity/v2/orchestrator.ts`, `server/capacity/table-assignment/*`: remove allocator v2 enable/shadow/legacy checks.
- `server/jobs/auto-assign.ts`: collapse retry policy to single scheme and decouple planner-cache flag if no longer needed.
- `server/capacity/strategic-config.ts`, `server/capacity/scarcity.ts`, `server/capacity/policy.ts`, `server/capacity/selector.ts`: replace dynamic strategic/scarcity logic with static constants and simplified scoring.
- `server/capacity/holds.ts`: drop rate limiting/min-TTL flag use; set fixed TTL constant and keep strict conflicts toggle if needed.
- Cleanup env examples/docs as needed (optional if time).

## Data Flow & API Contracts

- Feature flag accessors will return constants; remove branches expecting missing flags (allocator, adjacency mode, retry v2, hold rate limits).
- Policy hash versioning may change due to constant scarcity weight; ensure dependent functions use the new static config.

## UI/UX States

- No direct UI changes expected; ensure API behavior (holds TTL, auto-assign timing) remains stable from user perspective.

## Edge Cases

- Holds created near end time must still extend expiry past end; ensure TTL constant respects existing logic.
- Selector must still enforce adjacency/zone constraints even after scoring simplification.
- Auto-assign job must handle bookings already confirmed or with inline results; removing retry v2 branches should not drop necessary telemetry calls.

## Testing Strategy

- Unit/integration focus: run targeted capacity jobs/selector/holds tests if available (`pnpm test --filter capacity` or nearest equivalent); at minimum run relevant lint/tests for modified files if feasible.
- Manual sanity (non-UI): exercise hold creation and auto-assign paths in dev env via existing scripts if time permits.

## Rollout

- No feature flags to toggle after change; ensure env defaults align across environments. Document flag removals for deployers.

## DB Change Plan

- None (Supabase remote only; no schema/migration work planned).
