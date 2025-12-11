---
task: auto-assign-overlap
timestamp_utc: 2025-12-11T12:22:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Inline auto-assign overlap handling

## Objective

Reduce inline auto-assign failures caused by `allocations_no_overlap` during booking creation while preserving conflict safety and keeping guest experience intact.

## Success Criteria

- [ ] Inline auto-assign handles `allocations_no_overlap` without surfacing errors to guest; booking creation still completes.
- [ ] Background auto-assign job is scheduled when inline confirm fails; observability records the failure reason and attempt ID.
- [ ] Logs include idempotency key and hold id for diagnosis without leaking PII.

## Architecture & Components

- `server/bookings/inline-auto-assign.ts`: detect `allocations_no_overlap`/table conflict errors from `atomicConfirmAndTransition`; add controlled retry/fallback and enriched logs.
- `server/capacity/table-assignment/assignment.ts` (or caller handling): ensure errors are classified/propagated with codes.
- `server/jobs/auto-assign.ts`: verify fallback scheduling already present; may need explicit reason parameter.

## Data Flow & API Contracts

- Booking POST API stays the same. Inline flow will catch capacity overlap errors and trigger a background auto-assign attempt; response remains success with booking record.
- Observability event emitted with `reasonCode: allocations_no_overlap` when confirm fails.

## UI/UX States

- No UI change; guest still receives received/confirmation emails per existing flow.

## Edge Cases

- Hold expires between quote and confirm.
- Idempotency key reused after partial success causing conflict.
- Another allocation created after hold (race), leading to overlap.

## Testing Strategy

- Unit/Integration: add test for inline auto-assign handling `allocations_no_overlap` to ensure fallback path and result persistence.
- (No DB migration). Mock capacity confirm to throw and assert behavior.

## Rollout

- Feature flag: uses existing `autoAssignOnBooking`. No new flag.
- Monitoring: logs and observability events for `inline_auto_assign.confirm_failed` with reason code.
- Kill-switch: disable `autoAssignOnBooking` env flag if needed.

## DB Change Plan (if applicable)

- None expected; if we need a SQL tweak, stage-first with diff artifact.
