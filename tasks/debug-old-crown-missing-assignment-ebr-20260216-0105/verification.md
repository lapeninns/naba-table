---
task: debug-old-crown-missing-assignment-ebr
timestamp_utc: 2026-02-16T01:06:30Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

- N/A (no UI change in this task)

## Test Outcomes

- [x] Supabase evidence queries completed.
- [x] PostHog evidence queries completed (fallback path via `observability_events`; MCP unavailable).
- [x] Root-cause assessment documented with references.
- [x] `pnpm vitest tests/server/capacity/planner-reason.test.ts tests/server/capacity/availability-status-policy.test.ts` (5 tests passed).
- [x] `pnpm exec eslint server/capacity/planner-reason.ts server/capacity/planner-telemetry.ts server/capacity/table-assignment/availability.ts server/capacity/table-assignment/quote.ts server/capacity/table-assignment/types.ts tests/server/capacity/planner-reason.test.ts tests/server/capacity/availability-status-policy.test.ts` (pass).
- [x] `pnpm run typecheck` re-run after patching investigation artifact; only unrelated pre-existing error remains.

## Artifacts

- Evidence collector: `artifacts/fetch-incident-evidence.ts`
- Primary report: `artifacts/incident-evidence.json`
- Primary summary: `artifacts/incident-evidence-summary.txt`
- Booking payload extract: `artifacts/incident-bookings.json`
- Observability timeline extract: `artifacts/incident-observability-events.json`
- Slot availability snapshot (current state): `artifacts/incident-slot-analysis.json`
- Slot availability summary (current state): `artifacts/incident-slot-analysis-summary.txt`
- Historical occupancy reconstruction: `artifacts/incident-reconstructed-occupancy.json`
- Historical occupancy reconstruction summary: `artifacts/incident-reconstructed-occupancy-summary.txt`
- Human-readable timeline: `artifacts/incident-timeline.md`

## Known Issues

- [x] PostHog MCP unavailable in-session (`Unexpected content type: text/plain; charset=UTF-8`); direct PostHog API not available from current env secrets.
- [x] Resolved: Planner reason `Insufficient filtered capacity` now maps to hard code `hard.insufficient_filtered_capacity`.
- [x] Residual baseline: `pnpm run typecheck` fails on pre-existing unrelated file `tasks/booking-confirmation-pdf-template-20260212-1831/artifacts/pdf-template-smoke.ts` (`restaurant` possibly null).

## Sign-off

- [x] Engineering (diagnosis + production-safe patch + regression tests complete; no production DB writes performed)
