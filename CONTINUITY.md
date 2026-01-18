# Continuity Ledger

Last updated: 2026-01-18T00:15:00Z

## Goal (incl. success criteria)

- Fix critical pitfalls in table assignment system with proper default fixes (not fallbacks)
- Success: Race conditions prevented, data integrity enforced, no silent failures

## Constraints/Assumptions

- Supabase is remote-only; migrations require staging → production
- Follow SDLC phases; changes must be tested before merge
- No graceful degradation - prefer hard failures over silent data corruption
- No feature flags on pitfall fixes - they are always active

## Key decisions

- **Soft-holds are required** - failures are hard errors (503), not warnings
- **No graceful degradation** - data integrity over availability
- **Exponential backoff** for replication lag (25ms base, 4 retries)
- **CASCADE deletes** for FK constraints to prevent orphaned records
- **Remove setTimeout workarounds** - fix root cause instead

## State

- Branch: `algorithm/hold-race-condition-fix`
- PR #1: https://github.com/lapeninns/nabatable/pull/1
- Staging: All migrations applied

## Done

- [1d] Race condition fix: soft-holds with strict enforcement
  - Removed feature flag (always enabled)
  - Removed graceful degradation (hard errors on failure)
- [4e] Replication lag retry: exponential backoff (25→50→100→200ms) + hard failure after 4 retries
- [4b] Stale allocation cleanup: hard errors on load/delete failures (no try-catch swallowing)
- [6d] Cache invalidation timing: removed 500ms setTimeout delay workaround
- [7b] Orphaned assignments: CASCADE FK migration applied to staging
  - table_id FK: RESTRICT → CASCADE ✅
  - booking_id FK: already CASCADE ✅

## Now

- All pitfall fixes complete and pushed
- Staging verified

## Next

- Manual testing on staging to verify fixes
- Get PR review and merge
- Schedule production migration window (CASCADE FKs)

## Open questions

- None

## Working set

- Pitfalls doc: `Table_Assignment_System_Pitfalls_Critical_Paths.md`
- Migration log: `docs/DATABASE_MIGRATIONS.md`
- PR: https://github.com/lapeninns/nabatable/pull/1
