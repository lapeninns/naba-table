---
task: debug-old-crown-missing-assignment-ebr
timestamp_utc: 2026-02-16T01:06:30Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Production Assignment Incident Debug

## Objective

Identify the exact failure point that prevented table assignment for `ebrain@doctors.org.uk` at Old Crown Girton in production and provide actionable remediation.

## Success Criteria

- [x] Incident booking row(s) identified with exact IDs and timestamps.
- [x] Assignment path stage identified (quote/hold/commit/sync/summary).
- [x] Concrete root-cause category and evidence documented.
- [x] Remediation options listed with risk and rollback notes.

## Architecture & Components

- DB evidence: `customers`, `bookings`, `booking_table_assignments`, `table_inventory`, `table_adjacencies`, capacity/observability tables.
- Runtime logic: `server/jobs/auto-assign.ts`, assignment orchestration under `server/capacity/table-assignment/*`.
- Telemetry: PostHog (MCP or API fallback), plus app observability events when available.

## Data Flow & API Contracts

- Canonical assignment commit uses `assign_tables_atomic_v2` with `p_booking_id`, `p_table_ids`, `p_idempotency_key`, `p_require_adjacency`, `p_start_at`, `p_end_at`.
- Auto-assignment path records observability codes and can hard-stop on classified reasons.

## UI/UX States

- N/A (incident analysis task only)

## Edge Cases

- Multiple bookings for same contact across dates.
- Booking manually unassigned after successful initial assignment.
- Assignment commit succeeds but summary cache/realtime appears stale.
- Adjacency-required path with missing/incorrect adjacency graph.

## Testing Strategy

- Read-only Supabase SQL + telemetry correlation.
- Optional local unit-path inspection (no production writes).

## Rollout

- No rollout expected unless user requests a production fix.
