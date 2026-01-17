# Continuity Ledger

Last updated: 2026-01-17T23:25:00Z

## Goal (incl. success criteria)

- Fix race condition in table assignment hold creation using soft-hold pattern
- Success: Two operators selecting the same table simultaneously get early conflict feedback
- Success: No double-bookings can occur (database constraints remain the ultimate safety net)
- Success: Feature is gated behind `FEATURE_SOFT_HOLDS_ENABLED` flag (default: false)

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
- **Graceful degradation** - if soft-hold fails, continue without (log warning)
- **Skip soft-holds for instantTableAssignment()** - single atomic operation, minimal race window

## State

- Phase 3 (Implementation) **COMPLETE**
- Phase 4 (Verification) **IN PROGRESS**
- Unit tests passing (18/18)
- Integration tests pending (require database)

## Done

- Created task folder with research/plan/todo/verification stubs
- Implemented database schema: `table_soft_holds` table with exclusion constraint
- Implemented RPCs: `acquire_soft_holds_atomic`, `release_soft_holds`, `cleanup_expired_soft_holds`, `check_soft_hold_ownership`
- Created `server/capacity/table-assignment/soft-holds.ts` module with error classes and functions
- Updated Supabase types (`types/supabase.ts`)
- Integrated soft-holds into `evaluateManualSelection()`:
  - Acquires soft-holds before validation when feature enabled
  - Releases on validation failure
  - Returns session token in result
- Integrated soft-holds into `createManualHold()`:
  - Accepts session token from evaluation
  - Verifies ownership before creating real hold
  - Releases soft-holds after successful hold creation
- Added feature flag: `FEATURE_SOFT_HOLDS_ENABLED`
  - Added to `config/env.schema.ts`
  - Added to `lib/env.ts` under `featureFlags.holds.softHoldsEnabled`
  - Added `isSoftHoldsEnabled()` to `server/feature-flags.ts`
- Created unit tests: `tests/server/capacity/soft-holds.test.ts` (18 tests passing)
- Updated task todo.md with completed items

## Now

- Manual verification and documentation
- Consider integration tests if database access available

## Next

- Deploy migration to staging
- Enable `FEATURE_SOFT_HOLDS_ENABLED=true` on staging
- Manual QA: test race condition scenario with two browser tabs
- Document in `docs/TABLE_ASSIGNMENT_SYSTEM.md`

## Open questions (UNCONFIRMED if needed)

- None

## Working set (files/ids/commands)

- Branch: `algorithm/hold-race-condition-fix`
- Task: `tasks/hold-race-condition-fix-20260117-2315/`
- Migration: `supabase/migrations/20260117_add_soft_holds.sql`
- Key files:
  - `server/capacity/table-assignment/soft-holds.ts`
  - `server/capacity/table-assignment/manual.ts`
  - `server/feature-flags.ts`
  - `tests/server/capacity/soft-holds.test.ts`
