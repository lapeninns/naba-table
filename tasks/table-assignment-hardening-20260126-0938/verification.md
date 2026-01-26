---
task: table-assignment-hardening
timestamp_utc: 2026-01-26T09:38:31Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

- N/A (no UI changes expected)

## Test Outcomes

- [x] Happy paths
- [x] Error handling

## Automated Tests

- `pnpm run test -- tests/server/capacity/selector.test.ts`
- `pnpm run test -- tests/server/capacity/quote-strictness.test.ts tests/server/capacity/selector.test.ts`
- `pnpm run test -- tests/server/capacity/adjacency.test.ts tests/server/capacity/selector.test.ts`
- `pnpm tsx scripts/capacity-load-test.ts --restaurant a050d1ad-1ee0-4ea0-abc2-22c3778aa52c`

## Load Test Results

- Target: `The Old Crown Girton` (`a050d1ad-1ee0-4ea0-abc2-22c3778aa52c`)
- Params: iterations=200, concurrency=8, partySizes=2,4,6,8,10, kMax=5, combinations=true
  - Timing: p50=0.38ms, p90=0.85ms, p95=1.14ms, p99=2.62ms, max=16.81ms
  - Output: plansAvg=84.80, timeouts=0, adjacencySkips=1320
- Params: iterations=1000, concurrency=16, partySizes=2,4,6,8,10, kMax=5, combinations=true
  - Timing: p50=0.20ms, p90=0.50ms, p95=0.60ms, p99=1.29ms, max=23.59ms
  - Output: plansAvg=84.80, timeouts=0, adjacencySkips=6600

## Artifacts

- N/A (no UI artifacts)

## Known Issues

- [ ]

## Sign-off

- [ ] Engineering
- [ ] QA
