# Continuity Ledger

Last updated: 2026-01-18T00:30:00Z

## Goal (incl. success criteria)

- Fix critical pitfalls in table assignment system with proper default fixes (not fallbacks)
- Success: Race conditions prevented, data integrity enforced, no silent failures

## Constraints/Assumptions

- Supabase is remote-only; apply to staging only (no prod yet)
- Follow SDLC phases; changes must be tested before merge
- No graceful degradation - prefer hard failures over silent data corruption
- No feature flags on pitfall fixes - always active

## Key decisions

- Soft-holds are required; failures are hard errors (503)
- Rely on SECURITY DEFINER RPCs; no direct client access to `table_soft_holds`
- Instant assignment path must also use soft-holds
- Release soft-holds on any error to avoid TTL leaks

## State

- Branch: `algorithm/hold-race-condition-fix`
- PR #1: https://github.com/lapeninns/nabatable/pull/1
- Staging: CASCADE FK + soft-holds access lockdown applied

## Done

- [1d] Race condition fix: soft-holds with strict enforcement
- [4e] Replication lag retry: exponential backoff + hard failure
- [4b] Stale allocation cleanup: hard errors
- [6d] Cache invalidation timing: removed setTimeout workaround
- [7b] Orphaned assignments: CASCADE FK applied to staging
- Security fix: removed `authenticated` access to `table_soft_holds` (RLS/GRANTS) in staging
- Code hardening:
  - `evaluateManualSelection` releases soft-holds on any thrown error
  - `instantTableAssignment` acquires/releases soft-holds
  - Removed misleading `ManualSelectionOptions.softHoldSessionToken` (only hold creation uses tokens)

## Now

- Commit and push the latest code + migration/log updates

## Next

- Manual QA on staging (ops table assignment flows)
- Get PR review and merge
- Plan production change window (separately)

## Open questions

- None

## Working set

- `server/capacity/table-assignment/manual.ts`
- `server/capacity/table-assignment/types.ts`
- `supabase/migrations/20260118_lock_down_table_soft_holds_access.sql`
- `docs/DATABASE_MIGRATIONS.md`
