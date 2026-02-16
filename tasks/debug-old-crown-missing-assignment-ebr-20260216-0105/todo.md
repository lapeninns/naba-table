---
task: debug-old-crown-missing-assignment-ebr
timestamp_utc: 2026-02-16T01:06:30Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create task folder and SDLC docs.
- [x] Confirm prod project ref + restaurant identifier.

## Core

- [x] Pull target contact bookings for Old Crown Girton.
- [x] Correlate `booking_table_assignments` and assignment metadata.
- [x] Inspect auto-assign observability events/errors for incident window.
- [x] Pull PostHog signals for assignment flow (MCP or fallback).
- [x] Map evidence to canonical code path and isolate root cause.
- [x] Patch planner reason classification for `Insufficient filtered capacity`.
- [x] Patch `filterAvailableTables` to use a future-window status policy (exclude only `out_of_service`/unknown for future windows).
- [x] Emit filter-stage diagnostics through `quote.plannerStats` for observability.
- [x] Patch `filterAvailableTables` to derive mergeability from `deriveTableRules` (avoid raw `mobility !== "movable"` mismatch).
- [x] Patch adjacency gate to require adjacency metadata only for merge candidates (not single-table fits).
- [x] Patch selector fallback reasons to surface transient timeout/evaluation-limit outcomes.
- [x] Patch planner cache key to include `booking_type` to avoid cross-option cache collisions.

## Tests

- [x] Record deterministic SQL/query commands in artifacts.
- [x] Add regression tests for planner reason classification and availability status policy.
- [x] Add regression tests for selector fallback timeout reason and planner cache key booking-type separation.
- [x] Add regression test ensuring future-window mixed-status capacity still produces feasible planner output when capacity exists.
- [x] Run targeted `vitest` and `eslint` on touched files.

## Notes

- Assumptions: Incident is in production project `vrdiqfudmwydclqpydee` (validated).
- Deviations: PostHog MCP handshake failed (`Unexpected content type: text/plain`), so telemetry evidence used `observability_events` from production Supabase.
- Verification blocker: none.

## Batched Questions

- None.
