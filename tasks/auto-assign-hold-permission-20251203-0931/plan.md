---
task: auto-assign-hold-permission
timestamp_utc: 2025-12-03T09:31:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Auto-assign hold permission error

## Objective

Ensure booking auto-assign flow can create/inspect table holds without permission errors and that strict conflict enforcement is honored.

## Success Criteria

- [ ] POST bookings auto-assign completes without permission errors in staging.
- [ ] Strict conflict enforcement is applied with GUC enabled/validated.
- [ ] Regression tests or logs confirm successful auto-assign path.

## Architecture & Components

- Capacity planner/hold flow in `server/capacity/table-assignment/quote.ts` and confirmation in `server/capacity/table-assignment/assignment.ts`.
- Supabase client selection: default service client currently lacks tenant context for RLS-protected `table_holds`.

## Data Flow & API Contracts

- API: `POST /api/bookings` -> inline auto-assign uses `quoteTablesForBooking` then `atomicConfirmAndTransition`.
- Both functions rely on Supabase client for holds (`table_holds`, `table_hold_members`) and allocations via RLS.

## UI/UX States

- N/A (backend service change). Ensure API error surfaces remain structured.

## Edge Cases

- Missing/invalid restaurant context should fall back to tenant-scoped client; ensure no regressions for callers that already pass a client.
- Abort flows (timeout) should still avoid partial holds/assignments.

## Testing Strategy

- Unit: adjust/extend existing booking route tests to assert tenant client is used (if mocks present).
- Manual: reproduce inline auto-assign in staging; confirm no `permission denied for table table_holds` and strict conflict enforcement logs are absent.

## Rollout

- TBD; likely feature flag or config toggle not needed.

## DB Change Plan (if applicable)

- TBD; may require policy/permission updates via Supabase MCP; staging-first with rollback noted.
