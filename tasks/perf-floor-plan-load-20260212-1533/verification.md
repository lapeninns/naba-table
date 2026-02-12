---
task: perf-floor-plan-load
timestamp_utc: 2026-02-12T15:33:24Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification

## Automated

- [x] `pnpm run typecheck`
- [x] `pnpm run lint` (warnings only; no errors)
- [x] `pnpm vitest run tests/ops/useFloorPlanTables.test.tsx`

## Manual

- [~] `/app/floor-plan` load time improvement
  - Blocked here: route is auth-gated; cannot measure without a valid local ops session.
  - Change applied: floor plan no longer blocks initial render on timeline; table layout renders as soon as table inventory is available.
- [x] Dev harness smoke test (`/dev/ops-floor-plan`) renders and is interactive.
- [ ] Validate in an authenticated ops session:
  - `/api/ops/tables?includeSummary=0` returns quickly and includes `summary: null`.
  - `/api/ops/tables/timeline?includeSummary=0` returns quickly and includes `summary: null`.
  - No regressions for default behavior (no query param): summary still computed for consumers that need it.

## Artifacts

- Screenshot: `artifacts/dev-ops-floor-plan-full.png`
- Performance trace: `artifacts/dev-ops-floor-plan-trace.json.gz`
