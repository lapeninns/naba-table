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
- [x] `pnpm vitest tests/server/capacity/planner-reason.test.ts tests/server/capacity/availability-status-policy.test.ts tests/server/capacity/selector-fallback-reason.test.ts tests/server/capacity/planner-cache-key.test.ts tests/server/capacity/selector-merge-policy.test.ts` (15 tests passed).
- [x] `pnpm exec eslint server/capacity/table-assignment/availability.ts server/capacity/selector.ts server/capacity/planner-reason.ts server/capacity/planner-cache.ts server/jobs/auto-assign.ts tests/server/capacity/planner-reason.test.ts tests/server/capacity/availability-status-policy.test.ts tests/server/capacity/selector-fallback-reason.test.ts tests/server/capacity/planner-cache-key.test.ts` (pass).
- [x] `pnpm run typecheck` (pass).

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
- [x] Resolved: selector now emits transient fallback reason on planner timeout/evaluation-limit instead of collapsing to deterministic no-table reason.
- [x] Resolved: planner cache key now includes `booking_type`.
- [x] Resolved: `pnpm run typecheck` baseline blocker in `tasks/booking-confirmation-pdf-template-20260212-1831/artifacts/pdf-template-smoke.ts` patched (`restaurant` null-safe access).

## Sign-off

- [x] Engineering (diagnosis + production-safe patch + regression tests complete; no production DB writes performed)
