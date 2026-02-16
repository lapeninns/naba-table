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

## Tests

- [x] Record deterministic SQL/query commands in artifacts.
- [x] Add regression tests for planner reason classification and availability status policy.
- [x] Run targeted `vitest` and `eslint` on touched files.

## Notes

- Assumptions: Incident is in production project `vrdiqfudmwydclqpydee` (validated).
- Deviations: PostHog MCP handshake failed (`Unexpected content type: text/plain`), so telemetry evidence used `observability_events` from production Supabase.
- Verification blocker: Repo-wide `pnpm run typecheck` fails on pre-existing unrelated artifact file `tasks/booking-confirmation-pdf-template-20260212-1831/artifacts/pdf-template-smoke.ts`.

## Batched Questions

- None.
