# Implementation Checklist: Hold Creation Race Condition Fix

---

task: hold-race-condition-fix
timestamp_utc: 2026-01-17T23:15:00Z
owner: github:@amankumarshrestha

---

## Setup

- [x] Create feature flag `FEATURE_SOFT_HOLDS_ENABLED` (default: false)
- [x] Create `server/capacity/table-assignment/soft-holds.ts` module

## Database Schema

- [x] Create migration for `table_soft_holds` table
- [x] Add exclusion constraint for overlapping soft-holds
- [x] Create indexes for cleanup and session lookups
- [x] Create RPC function `acquire_soft_holds_atomic`
- [x] Create RPC function `release_soft_holds`
- [x] Create RPC function `cleanup_expired_soft_holds`
- [x] Create RPC function `check_soft_hold_ownership`

## Core Implementation

- [x] Implement `SoftHoldConflictError` error class
- [x] Implement `SoftHoldExpiredError` error class
- [x] Implement `acquireSoftHolds()` function
- [x] Implement `releaseSoftHolds()` function
- [x] Implement `checkSoftHoldOwnership()` function
- [x] Implement `cleanupExpiredSoftHolds()` function

## Integration with Hold Creation

- [x] Modify `evaluateManualSelection()` to acquire soft-holds
- [x] Add session token to evaluation result
- [x] Modify `createManualHold()` to accept session token
- [x] Add soft-hold ownership verification during hold creation
- [x] Add soft-hold release on evaluation failure
- [x] Add soft-hold release after successful hold creation

## Feature Flag Integration

- [x] Add feature flag to env schema (config/env.schema.ts)
- [x] Add feature flag to lib/env.ts
- [x] Add `isSoftHoldsEnabled()` to server/feature-flags.ts
- [x] Add feature flag check in `evaluateManualSelection()`
- [x] Ensure fallback to existing behavior when disabled

## UI/UX Updates

- [x] Update error messages for soft-hold conflicts (SOFT_HOLD_CONFLICT)
- [x] Add "table being selected by another operator" feedback
- [x] Add error message for expired soft-holds (SOFT_HOLD_EXPIRED)

## Tests

- [x] Unit test: `acquireSoftHolds()` success case
- [x] Unit test: `acquireSoftHolds()` conflict case
- [x] Unit test: `acquireSoftHolds()` TTL clamping
- [x] Unit test: `acquireSoftHolds()` RPC error handling
- [x] Unit test: `releaseSoftHolds()` success case
- [x] Unit test: `releaseSoftHolds()` error handling
- [x] Unit test: `checkSoftHoldOwnership()` success case
- [x] Unit test: `checkSoftHoldOwnership()` expired case
- [x] Unit test: `cleanupExpiredSoftHolds()` success case
- [ ] Integration test: Concurrent evaluation race condition (requires DB)
- [ ] Integration test: Soft-hold TTL expiry (requires DB)

## Documentation

- [ ] Update `docs/TABLE_ASSIGNMENT_SYSTEM.md` with soft-hold pattern
- [x] Add observability events for soft-hold metrics

## Notes

### Assumptions

- Supabase supports exclusion constraints with GiST indexes (btree_gist extension)
- Session tokens are UUIDs generated server-side
- 10-second TTL is sufficient for evaluation + hold creation
- Soft-holds are an optimization, not a hard requirement (graceful degradation)

### Deviations

- Skipped soft-holds for `instantTableAssignment()` since it's a single atomic operation

## Batched Questions

- None

## Files Modified

- `supabase/migrations/20260117_add_soft_holds.sql` - Database schema and RPCs
- `server/capacity/table-assignment/soft-holds.ts` - New module
- `server/capacity/table-assignment/manual.ts` - Integration
- `server/capacity/table-assignment/types.ts` - Type updates
- `types/supabase.ts` - Database types
- `config/env.schema.ts` - Feature flag schema
- `lib/env.ts` - Feature flag exposure
- `server/feature-flags.ts` - Feature flag function
- `tests/server/capacity/soft-holds.test.ts` - Unit tests
