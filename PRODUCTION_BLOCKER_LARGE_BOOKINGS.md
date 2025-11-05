# 🚨 PRODUCTION BLOCKER: Large Bookings Not Assigning Tables

## Issue Discovered

**Date**: November 5, 2025
**Status**: CRITICAL - Production deployment BLOCKED
**Impact**: Cannot assign tables for bookings of 11+ people

## Evidence

### Recent Booking Analysis

Checked 78 bookings created in the last hour:

#### ✅ Working (Small-Medium Parties 2-9 people)

- All 2-9 person parties getting assigned (either single tables or combinations)
- Examples:
  - Party of 9: Single table assigned ✅
  - Party of 2: Combination of 2 tables assigned ✅
  - Party of 7: Single table assigned ✅

#### ❌ FAILING (Large Parties 11-14 people)

- **ALL large bookings staying in PENDING status with 0 table assignments**
- Affected bookings:
  - `N710FCUD3V`: Party of 12 at Old Crown Pub - **NO TABLES**
  - `COMBO-11-1` through `COMBO-11-5`: Party of 11 - **NO TABLES**
  - `COMBO-12-1` through `COMBO-12-3`: Party of 12 - **NO TABLES**
  - `COMBO-14-1` through `COMBO-14-2`: Party of 14 - **NO TABLES**

## Root Cause Analysis

### Hypothesis 1: k-max limit too restrictive

- Current setting: `FEATURE_ALLOCATOR_K_MAX=3`
- For parties of 11-14, might need 4-5 tables
- Algorithm stops searching after 3 tables

### Hypothesis 2: No viable combinations exist

- Not enough movable tables in the same zone
- Tables not adjacent
- Total capacity insufficient

### Hypothesis 3: Algorithm timeout/performance

- Large search space causes timeout
- No solutions found within evaluation limit

## Investigation Steps

1. ✅ Check actual table inventory for affected restaurants
2. ⚠️ Test with higher k-max values (4, 5, 6)
3. ⚠️ Check if adjacency requirement is blocking combinations
4. ⚠️ Verify zone constraints aren't too restrictive
5. ⚠️ Add detailed logging to understand why no combinations found

## Immediate Actions Required

### Before Production Deployment

- [ ] Identify exact cause of large booking failures
- [ ] Fix algorithm or configuration
- [ ] Test successfully assigning 11-14 person parties
- [ ] Update smoke tests to catch this scenario
- [ ] Re-run production verification

### Potential Fixes

1. **Increase k-max**: Try `FEATURE_ALLOCATOR_K_MAX=5` or `6`
2. **Disable adjacency requirement**: Confirm `FEATURE_ALLOCATOR_REQUIRE_ADJACENCY=false`
3. **Algorithm optimization**: Improve search efficiency for large parties
4. **Fallback strategy**: Manual assignment for very large parties

## Impact on Production Readiness

**STATUS: NOT READY FOR PRODUCTION**

This is a critical functional issue that affects core booking functionality. Restaurants commonly have parties of 10-15 people, and these bookings are failing silently (staying pending forever).

### What Was Verified ✅

- Configuration files
- Database migration
- Documentation
- Monitoring scripts
- Small booking assignments (2-9 people)

### What Is Broken ❌

- **Large booking assignments (11+ people)**
- This breaks the core value proposition of table combinations

## Next Steps

1. Run diagnostic on table inventory:

   ```bash
   pnpm tsx -r tsconfig-paths/register scripts/diagnose-large-booking-failure.ts
   ```

2. Test with increased k-max:

   ```bash
   # In .env.local, change to:
   FEATURE_ALLOCATOR_K_MAX=6
   ```

3. Retry failed bookings manually to see logs

4. Fix algorithm/config

5. Re-verify production readiness

## Timeline

- **Discovered**: 2025-11-05 (during final verification)
- **Expected Fix**: Within 24 hours
- **Production Deployment**: BLOCKED until resolved

---

**Priority**: P0 - Critical Blocker
**Owner**: Development Team
**Related Docs**:

- TABLE_COMBINATIONS_SUMMARY.md
- PRODUCTION_VERIFICATION_REPORT.md
- TABLE_COMBINATION_RULES.md
