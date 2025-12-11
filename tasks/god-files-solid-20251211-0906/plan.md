---
task: god-files-solid
timestamp_utc: 2025-12-11T09:06:54Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Reduce god files & improve SOLID

## Objective

We will break down oversized backend modules into smaller, single-responsibility units with clearer boundaries and optional interfaces to improve testability and adherence to SOLID.

## Success Criteria

- [ ] Identify top "god" files and document their responsibilities and dependencies.
- [ ] Split at least one high-impact file into cohesive modules with clear contracts.
- [ ] Add/update tests (unit) for the refactored pieces.
- [ ] No behavioral regressions (existing tests remain green).

## Architecture & Components

- Targeted module: `server/capacity/table-assignment/assignment.ts` (table confirmation/assignment orchestration).
- New helpers extracted:
  - `assignment-sync.ts` — sync persisted assignments/allocations and emit outbox events.
  - `confirmation-cache.ts` — idempotent cache lookup for prior confirmations.
  - `booking-state.ts` — fetch booking assignment state + reconcile orphaned assignments.
  - `policy-drift.ts` — parse/publish policy drift details/notifications.
- Orchestrator stays in `assignment.ts` but delegates to the above for SRP and easier testing.

## Data Flow & API Contracts

- Public exports unchanged (`confirmHoldAssignment`, `atomicConfirmAndTransition`, `assignTableToBooking`, etc.).
- Internals now depend on extracted helpers; Supabase client contract remains the same (DbClient).

## UI/UX States

- N/A (backend only)

## Edge Cases

- Policy drift handling and reconciliation remain intact; fallback RPC path still present.

## Testing Strategy

- Vitest unit coverage for new modules.

## Rollout

- No feature flag; pure refactor.

## DB Change Plan (if applicable)

- N/A
