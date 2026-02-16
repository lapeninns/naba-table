---
task: fix-ops-booking-edit-regression
timestamp_utc: 2026-02-16T13:21:23Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Fix ops booking edit regression

## Objective

Ensure dashboard-originated ops booking edits send canonical offset-aware datetimes so ops `PATCH /api/ops/bookings/:id` succeeds without weakening validation.

## Success Criteria

- [x] Dashboard DTO mapper emits offset-aware ISO for `startIso` and `endIso`.
- [x] Ops edit from dashboard no longer produces `400 Invalid payload` for datetime shape at payload contract level (validated by mapper + regression test).
- [x] Guest edit flows remain unchanged.
- [x] Regression test covers timezone-aware conversion behavior.

## Architecture & Components

- `src/components/features/dashboard/list/utils.ts`
  - Upgrade `toIsoTime` to timezone-aware normalization and UTC ISO output.
- `src/components/features/dashboard/list/BookingsListVirtualized.tsx`
  - Pass `summary.timezone` to `toIsoTime` calls.
- `tests/components/opsDashboardListUtils.test.ts`
  - Add regression tests for offset output and fallback behavior.

## Data Flow & API Contracts

- No API contract changes.
- Preserve strict API input contract at boundary:
  - `startIso/endIso` must include timezone offset.

## UI/UX States

- No visual changes; behavior-only fix for edit submission reliability.

## Edge Cases

- Missing/invalid timezone should still produce parseable ISO fallback.
- Missing time should default to midnight while remaining offset-aware.

## Testing Strategy

- Targeted unit tests for `toIsoTime`.
- Targeted typecheck/lint for touched files.
- Vercel last-15m log check post-patch (if traffic reproduces) to confirm no new 400 for ops edit payload shape.

## Rollout

- No flag needed; bug fix in canonical dashboard mapping path.
- Monitor request logs for `/api/ops/bookings/[id]` 400-rate immediately after deploy.

## DB Change Plan (if applicable)

- N/A
