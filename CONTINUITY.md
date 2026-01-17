# Continuity Ledger

Last updated: 2026-01-17T23:55:00Z

## Goal (incl. success criteria)

- Fix race condition in table assignment hold creation using soft-hold pattern
- Success: Two operators selecting the same table simultaneously get early conflict feedback
- Success: No double-bookings can occur (database constraints remain the ultimate safety net)
- Success: Soft-holds always enabled (feature flag removed)

## Constraints/Assumptions

- Follow SDLC phases; soft-holds are an optimization layer, not a hard requirement
- Task folder required with artifacts: `tasks/hold-race-condition-fix-20260117-2315/`
- Supabase is remote-only; migration requires staging → production deployment
- Database `assign_tables_atomic_v2` remains the ultimate conflict resolver
- 10-second TTL for soft-holds is sufficient for evaluation + hold creation

## Key decisions

- **Soft-Hold Pattern (Option 3)** selected over pessimistic locking or optimistic versioning
  - High throughput, early conflict detection, excellent scalability
- **Session-based ownership** using UUIDs generated server-side
- **Atomic acquisition with rollback** - if any table blocked, release all acquired
- **Strict enforcement** - soft-hold failures are hard errors (no graceful degradation)
- **Skip soft-holds for instantTableAssignment()** - single atomic operation, minimal race window

## State

- Phase 3 (Implementation) **COMPLETE**
- Phase 4 (Verification) **PARTIAL** - Unit tests complete, manual QA pending
- Phase 5 (Review & Merge) **IN PROGRESS** - PR created

## Done

- Created task folder with research/plan/todo/verification stubs
- Implemented database schema: `table_soft_holds` table with exclusion constraint
- Implemented RPCs: `acquire_soft_holds_atomic`, `release_soft_holds`, `cleanup_expired_soft_holds`, `check_soft_hold_ownership`
- Created `server/capacity/table-assignment/soft-holds.ts` module with error classes and functions
- Updated Supabase types (`types/supabase.ts`)
- Integrated soft-holds into `evaluateManualSelection()` and `createManualHold()`
- Created unit tests: `tests/server/capacity/soft-holds.test.ts` (18 tests passing)
- **Committed all implementation changes**
- **Applied migration to Supabase staging** (2026-01-17)
- **Created PR #1**: https://github.com/lapeninns/nabatable/pull/1
- **Removed feature flag** - soft-holds now always enabled
- **Removed graceful degradation** - soft-hold failures are now hard errors (503)

## Now

- PR review in progress
- Ready for manual QA testing on staging

## Next

- Manual QA: test race condition scenario with two browser tabs on staging
- Get PR approved and merged
- Apply migration to production

## Open questions (UNCONFIRMED if needed)

- None

## Working set (files/ids/commands)

- Branch: `algorithm/hold-race-condition-fix`
- PR: https://github.com/lapeninns/nabatable/pull/1
- Task: `tasks/hold-race-condition-fix-20260117-2315/`
- Migration: `supabase/migrations/20260117_add_soft_holds.sql`
- Commits:
  - `1b724d4c` - feat(capacity): add soft-hold pattern
  - `ca7bb26b` - docs: update migration log and verification
  - `344f2883` - chore: update continuity ledger
  - `5802e798` - docs: mark migration as applied to staging
- Key files:
  - `server/capacity/table-assignment/soft-holds.ts`
  - `server/capacity/table-assignment/manual.ts`
  - `server/feature-flags.ts`
  - `tests/server/capacity/soft-holds.test.ts`
