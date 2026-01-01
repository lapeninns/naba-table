# Auto-Assign Unification - Summary

## Objective

Unified the auto-assignment logic between public bookings and ops/walk-in bookings to use the same sophisticated inline auto-assign implementation.

## Changes Made

### 1. Created Shared Inline Auto-Assign Service

**File:** `src/services/inline-auto-assign.ts`

Created a reusable `runInlineAutoAssign()` function that encapsulates:

- Timeout-controlled auto-assignment (default 4s, configurable)
- Full observability telemetry
- Quote generation via `quoteTablesForBooking`
- Atomic confirmation via `atomicConfirmAndTransition`
- Comprehensive error handling
- Result persistence to `auto_assign_last_result`

### 2. Refactored Public Bookings Endpoint

**File:** `src/app/api/bookings/route.ts`

**Before:**

- ~340 lines of inline auto-assign logic embedded directly in the route
- Duplicated code for timeout handling, telemetry, and error recovery

**After:**

- Simple call to `runInlineAutoAssign()` service (~25 lines)
- All complexity extracted into shared module
- Removed unused imports: `buildInlineLastResult`, `classifyPlannerReason`, `recordPlannerQuoteTelemetry`

### 3. Refactored Ops/Walk-in Bookings Endpoint

**File:** `src/app/api/ops/bookings/route.ts`

**Before:**

- Simple `autoAssignAndConfirmIfPossible()` call
- Single attempt only (maxAttemptsOverride: 1)
- Minimal telemetry
- No timeout control

**After:**

- Uses the same `runInlineAutoAssign()` service as public bookings
- Full timeout handling and cancellation support
- Complete observability telemetry
- Same background retry logic (via existing public booking flow)
- Removed unused import: `autoAssignAndConfirmIfPossible`

### 4. Key Configuration Differences

Both endpoints now use identical auto-assign logic with these source-specific parameters:

| Parameter             | Public Bookings                        | Ops/Walk-in                             |
| --------------------- | -------------------------------------- | --------------------------------------- |
| `createdBy`           | `'api-booking'`                        | `'ops-walk-in'`                         |
| `historyReason`       | `'api_inline_auto_assign'`             | `'ops_walk_in_inline_auto_assign'`      |
| `observabilitySource` | `'bookings.inline_auto_assign'`        | `'api.ops.bookings.inline_auto_assign'` |
| `timeoutMs`           | 4000ms (configurable via feature flag) | 4000ms (same)                           |

## Benefits

1. **Code Consistency** - Same table selection algorithm regardless of booking source
2. **Better Observability** - Ops bookings now have full telemetry like public bookings
3. **Maintainability** - Single source of truth for auto-assign logic
4. **Resilience** - Ops bookings now benefit from timeout handling and graceful degradation
5. **DRY Principle** - Eliminated ~340 lines of duplicated code

## Backward Compatibility

- ✅ All existing feature flags respected (`autoAssignOnBooking`, `inlineAutoAssignTimeoutMs`)
- ✅ History reasons preserved for audit trails
- ✅ Observability events maintain separate sources for filtering
- ✅ No breaking changes to API contracts

## Testing Recommendations

1. **Integration Tests**
   - Test public booking auto-assign with available tables
   - Test ops walk-in auto-assign with available tables
   - Test timeout behavior (<4s response time)
   - Verify observability events are logged correctly

2. **Manual Testing**
   - Create public booking → verify auto-assignment
   - Create ops walk-in → verify auto-assignment
   - Monitor logs for proper telemetry
   - Check `auto_assign_last_result` field in bookings table

## Removed Legacy Code

- **Deleted function:** `autoAssignAndConfirmIfPossible` (no longer referenced)
- **Removed file:** `server/booking/inline-auto-assign.ts` (duplicate with wrong path)
- **Cleaned up imports:** Removed inline auto-assign utilities from route files

## Migration Notes

If you need to adjust auto-assign behavior in the future:

- ✅ Edit `src/services/inline-auto-assign.ts` once
- ❌ **Don't** edit route files individually
- Feature flags still control enable/disable and timeout values
