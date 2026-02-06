# Continuity Ledger

Last updated: 2026-02-06T10:22:40Z

## Goal (incl. success criteria)

- Enforce Ops table assignment eligibility by status + date on both client and server.
- Success: completed/cancelled/no_show cannot assign/unassign; only allowed statuses and today/future date.
- Success: UI shows locked messaging; server returns ASSIGNMENT_LOCKED for disallowed actions.
- Success: policy helpers tested.

## Constraints/Assumptions

- Follow root + path-level AGENTS policies.
- Supabase operations are remote-only.
- User requested skipping Chrome DevTools QA; document waiver in task artifacts.
- Missing booking date or timezone => treat as not allowed (timezone fallback to UTC).

## Key decisions

- Single source of truth policy in lib/ops/table-assignment-policy.ts.
- Server enforcement in direct-assignment guard + unassign guard.

## State

- Phase 3: Implementation complete; verification update in progress.

## Done

- Added status+date policy helper in lib/ops/table-assignment-policy.ts.
- Enforced policy in BookingDetailsDialogWrapper and Ops list gating.
- Added server guard in direct-assignment assign/unassign.
- Added unit tests: tests/utils/tableAssignmentPolicy.test.ts.
- Updated task research/plan/todo/verification with policy addendum and DevTools waiver note.

## Now

- Finalize response and explain updated assignment logic.

## Next

- Optional: run broader typecheck/lint if requested.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- lib/ops/table-assignment-policy.ts
- server/capacity/table-assignment/direct-assignment.ts
- src/components/features/dashboard/list/BookingsListVirtualized.tsx
- tests/utils/tableAssignmentPolicy.test.ts
- tasks/ops-booking-dialog-redesign-20260206-0116/{research,plan,todo,verification}.md
