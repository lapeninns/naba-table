---
task: fix-ops-booking-edit-regression
timestamp_utc: 2026-02-16T13:21:23Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Capture last-15m Vercel logs and isolate failing ops booking edit request.
- [x] Correlate ops/guest mapping paths and API validation boundary.

## Core

- [x] Patch `toIsoTime` to output offset-aware ISO in dashboard list utils.
- [x] Pass timezone through `BookingsListVirtualized` mapper calls.

## Tests

- [x] Add regression tests for dashboard list datetime conversion.
- [x] Run targeted vitest for new/updated tests.
- [x] Run targeted typecheck/lint for touched files.

## Notes

- PostHog MCP is unavailable in current session; using Vercel request logs + repo instrumentation behavior for telemetry evidence.

## Batched Questions

- None.
