# Production Deployment Runbook - Table Combinations Feature

**Feature**: Multi-Table Combination Assignments  
**Version**: 1.0  
**Date**: November 5, 2025  
**Owner**: Engineering Team

---

## Pre-Deployment Checklist

### 1. Environment Preparation

- [ ] **Review `.env.example`**
  - Ensure all combination flags are documented
  - Verify production recommendations are clear
- [ ] **Configure Production Environment Variables**

  ```bash
  FEATURE_COMBINATION_PLANNER=true
  FEATURE_ALLOCATOR_MERGES_ENABLED=true
  FEATURE_ALLOCATOR_K_MAX=3
  FEATURE_SELECTOR_MAX_COMBINATION_EVALUATIONS=1000
  FEATURE_ALLOCATOR_REQUIRE_ADJACENCY=false  # true if adjacency data populated
  ```

- [ ] **Verify Supabase Connection**
  ```bash
  # Test connection
  pnpm tsx -r tsconfig-paths/register scripts/test-feature-flags.ts
  ```

### 2. Database Preparation

- [ ] **Backup Production Database**

  ```bash
  # Create backup before migration
  pnpm supabase db dump -f backups/pre-combinations-$(date +%Y%m%d-%H%M%S).sql
  ```

- [ ] **Review Migration**
  - File: `supabase/migrations/20251105000000_add_booking_assignment_constraint.sql`
  - Purpose: Prevent orphaned bookings (confirmed with 0 assignments)
  - Action: Adds trigger + index + data cleanup

- [ ] **Test Migration on Staging**

  ```bash
  # Apply to staging first
  pnpm supabase db push --db-url $STAGING_DB_URL
  ```

- [ ] **Check for Existing Orphaned Bookings**
  ```bash
  pnpm tsx -r tsconfig-paths/register scripts/fix-orphaned-bookings.ts
  ```

### 3. Code Review

- [ ] **All Test-Specific Code Reverted**
  - `scripts/ops-auto-assign-ultra-fast.ts`: Uses current date (not hardcoded)
  - `scripts/check-table-combinations.ts`: Uses current date (not hardcoded)

- [ ] **Feature Flags Verified**

  ```bash
  pnpm tsx -r tsconfig-paths/register scripts/test-feature-flags.ts

  # Expected output:
  # ✅ isCombinationPlannerEnabled() = true
  # ✅ isAllocatorAdjacencyRequired() = false (or true if data populated)
  # ✅ getAllocatorKMax() = 3
  ```

- [ ] **No Hardcoded Credentials**
  - Review: `.env.local` not committed
  - Review: All scripts use env vars

### 4. Testing

- [ ] **Run Smoke Tests** (create if needed)

  ```bash
  pnpm test -- combinations
  ```

- [ ] **Manual QA**
  - Create test booking with party size 5
  - Verify tables assigned correctly
  - Check combination logic fires when appropriate
  - Verify single-table assignment when available

- [ ] **Performance Baseline**

  ```bash
  # Test assignment speed
  time pnpm tsx -r tsconfig-paths/register scripts/ops-auto-assign-ultra-fast.ts

  # Target: <10 seconds per booking
  ```

---

## Deployment Steps

### Phase 1: Database Migration (Low Risk)

**Time**: 5-10 minutes  
**Rollback**: Easy (drop trigger)

1. **Apply Migration to Production**

   ```bash
   pnpm supabase db push
   ```

2. **Verify Migration**

   ```sql
   -- Check trigger exists
   SELECT tgname
   FROM pg_trigger
   WHERE tgname = 'booking_assignment_validation';

   -- Check function exists
   SELECT proname
   FROM pg_proc
   WHERE proname = 'validate_booking_has_assignments';

   -- Check index exists
   SELECT indexname
   FROM pg_indexes
   WHERE indexname = 'idx_booking_table_assignments_booking_id';
   ```

3. **Check Migration Output**
   - Should report: "No orphaned confirmed bookings found" OR
   - Should report: "Successfully reset X orphaned bookings to pending status"

### Phase 2: Application Deployment (Medium Risk)

**Time**: 15-30 minutes  
**Rollback**: Disable feature flags

1. **Deploy Application Code**

   ```bash
   # Your deployment command (e.g., Vercel, AWS, etc.)
   npm run deploy
   ```

2. **Verify Environment Variables**
   - Check production environment variables are set correctly
   - Confirm all combination flags are enabled

3. **Monitor Application Start**
   - Check logs for errors
   - Verify feature flags loading correctly

### Phase 3: Enable Feature (Gradual Rollout)

**Time**: 1-3 hours  
**Rollback**: Set flags to false

#### Option A: Gradual Rollout (RECOMMENDED)

1. **Start with One Restaurant**

   ```bash
   # Enable for test restaurant only
   # (Implement restaurant-level feature flags if not already available)
   ```

2. **Monitor for 1 Hour**

   ```bash
   # Run monitoring every 15 minutes
   watch -n 900 pnpm tsx -r tsconfig-paths/register scripts/production-monitor.ts
   ```

3. **Expand to 10% of Restaurants**
   - Enable for select restaurants
   - Monitor for 2-4 hours
   - Check error rates, combination usage

4. **Expand to 50%**
   - Monitor for 1 day
   - Review combination usage patterns
   - Check customer feedback

5. **Enable for All Restaurants**
   - Final monitoring
   - Document learnings

#### Option B: Full Rollout (If Confident)

1. **Enable Globally**
   - Combination flags already set to `true`
   - Feature is live immediately on deployment

2. **Monitor Intensively**
   ```bash
   # First hour: every 5 minutes
   # Next 3 hours: every 15 minutes
   # Next 24 hours: every hour
   pnpm tsx -r tsconfig-paths/register scripts/production-monitor.ts
   ```

---

## Verification Steps

### Immediately After Deployment

- [ ] **Check Application Health**

  ```bash
  curl https://your-domain.com/api/health
  ```

- [ ] **Create Test Booking**
  - Party size: 5 (optimal for combinations)
  - Verify assignment succeeds
  - Check if combination used

- [ ] **Run Production Monitor**

  ```bash
  pnpm tsx -r tsconfig-paths/register scripts/production-monitor.ts --days=1
  ```

- [ ] **Check for Errors**
  - Application logs
  - Supabase logs
  - Error tracking (Sentry, etc.)

### 1 Hour After Deployment

- [ ] **Combination Usage Check**

  ```bash
  pnpm tsx -r tsconfig-paths/register scripts/check-table-combinations.ts

  # Expect: 5-15% combination usage
  ```

- [ ] **Data Integrity Check**
  - No orphaned bookings
  - No zone lock conflicts
  - All confirmed bookings have assignments

- [ ] **Performance Check**
  - Assignment latency < 10 seconds
  - No timeout errors
  - Database query performance acceptable

### 24 Hours After Deployment

- [ ] **Run Full Monitoring Report**

  ```bash
  pnpm tsx -r tsconfig-paths/register scripts/production-monitor.ts --days=1
  ```

- [ ] **Review Metrics**
  - Combination usage %
  - Assignment success rate
  - Average tables per booking
  - Orphaned bookings count

- [ ] **Customer Feedback**
  - Check support tickets
  - Review any combination-related issues
  - Verify customer satisfaction

---

## Rollback Procedures

### Level 1: Disable Feature (Fastest - 2 minutes)

**Use When**: Combinations causing errors, performance issues, or customer complaints

```bash
# Set environment variables
FEATURE_COMBINATION_PLANNER=false
FEATURE_ALLOCATOR_MERGES_ENABLED=false

# Restart application
npm run restart  # Or your restart command
```

**Impact**: System reverts to single-table assignments only

**Data**: No data loss, existing combinations remain

### Level 2: Rollback Database Migration (Medium - 10 minutes)

**Use When**: Migration causing database errors or performance issues

```sql
-- Drop trigger
DROP TRIGGER IF EXISTS booking_assignment_validation ON bookings;

-- Drop function
DROP FUNCTION IF EXISTS validate_booking_has_assignments;

-- Drop index (optional - may want to keep for performance)
-- DROP INDEX IF EXISTS idx_booking_table_assignments_booking_id;
```

**Impact**: Orphaned bookings can occur again (but rare)

**Data**: No data loss

### Level 3: Full Revert (Slowest - 30 minutes)

**Use When**: Critical production issues require complete rollback

1. **Disable Feature Flags** (Level 1)
2. **Rollback Database Migration** (Level 2)
3. **Restore from Backup** (if data corrupted)
   ```bash
   pnpm supabase db reset --db-url $PRODUCTION_DB_URL < backups/pre-combinations-TIMESTAMP.sql
   ```
4. **Deploy Previous Code Version**
   ```bash
   git revert HEAD
   npm run deploy
   ```

---

## Monitoring & Alerts

### Key Metrics to Track

1. **Combination Usage Rate**
   - Target: 5-15%
   - Alert if: < 2% or > 30%

2. **Assignment Success Rate**
   - Target: > 90%
   - Alert if: < 80%

3. **Orphaned Bookings**
   - Target: 0
   - Alert if: > 0 (critical)

4. **Performance**
   - Target: < 10 seconds per booking
   - Alert if: > 15 seconds average

5. **Zone Lock Conflicts**
   - Target: 0
   - Alert if: > 5 per day

### Monitoring Schedule

**First Week**:

- Day 1: Every hour
- Day 2-3: Every 4 hours
- Day 4-7: Once per day

**Ongoing**:

- Daily automated reports
- Weekly manual review
- Monthly deep dive

### Automated Monitoring

```bash
# Add to cron (run every hour)
0 * * * * cd /path/to/app && pnpm tsx -r tsconfig-paths/register scripts/production-monitor.ts --days=1 >> logs/monitoring.log 2>&1

# Alert on critical issues (exit code 1)
0 * * * * cd /path/to/app && pnpm tsx -r tsconfig-paths/register scripts/production-monitor.ts --days=1 || mail -s "ALERT: Table Combinations Issue" ops@yourdomain.com
```

---

## Troubleshooting

### Issue: No combinations being used

**Symptoms**: 0% combination usage

**Diagnosis**:

```bash
pnpm tsx -r tsconfig-paths/register scripts/test-feature-flags.ts
pnpm tsx -r tsconfig-paths/register scripts/debug-combinations.ts
```

**Solutions**:

1. Check feature flags (must be `true`)
2. Verify table inventory has movable tables
3. Check for sufficient capacity variance (need tables of different sizes)
4. Review adjacency setting (may be too restrictive)

### Issue: High combination usage (>30%)

**Symptoms**: Most bookings using combinations

**Diagnosis**: Insufficient large tables in inventory

**Solutions**:

1. Review party size distribution vs table capacity
2. Add more large tables to inventory
3. Consider this normal if you have many large parties

### Issue: Orphaned bookings appearing

**Symptoms**: Confirmed bookings with 0 table assignments

**Diagnosis**: Transaction bug or migration not applied

**Solutions**:

```bash
# Fix existing orphans
pnpm tsx -r tsconfig-paths/register scripts/fix-orphaned-bookings.ts

# Verify migration applied
pnpm supabase db push

# Check trigger exists
psql $DATABASE_URL -c "SELECT tgname FROM pg_trigger WHERE tgname = 'booking_assignment_validation';"
```

### Issue: Performance degradation

**Symptoms**: Slow assignment, timeouts

**Diagnosis**: Combination enumeration taking too long

**Solutions**:

```bash
# Reduce K-max (try 2 instead of 3)
FEATURE_ALLOCATOR_K_MAX=2

# Reduce evaluation limit
FEATURE_SELECTOR_MAX_COMBINATION_EVALUATIONS=500

# Enable adjacency to reduce search space (if data available)
FEATURE_ALLOCATOR_REQUIRE_ADJACENCY=true
```

### Issue: Illogical table groupings

**Symptoms**: Tables from opposite sides of room combined

**Diagnosis**: Adjacency disabled, no data available

**Solutions**:

1. Populate `table_adjacencies` table (see `POPULATING_ADJACENCY_DATA.md`)
2. Enable `FEATURE_ALLOCATOR_REQUIRE_ADJACENCY=true`
3. Test with realistic bookings

---

## Post-Deployment Tasks

### Immediate (Within 1 Week)

- [ ] Document any issues encountered
- [ ] Update runbook with learnings
- [ ] Create FAQ for support team
- [ ] Review customer feedback
- [ ] Adjust feature flags if needed

### Short Term (Within 1 Month)

- [ ] Populate adjacency data (see `POPULATING_ADJACENCY_DATA.md`)
- [ ] Enable adjacency requirement
- [ ] Run stress test (500-1000 bookings)
- [ ] Optimize performance based on metrics
- [ ] Create UI indicators for multi-table bookings

### Long Term (1-3 Months)

- [ ] Build analytics dashboard
- [ ] Implement machine learning optimization
- [ ] Add A/B testing for combination strategies
- [ ] Collect operator feedback
- [ ] Plan phase 2 enhancements

---

## Success Criteria

Deployment is considered successful when:

- ✅ 0 critical errors in 48 hours
- ✅ Combination usage 5-15%
- ✅ Assignment success rate > 90%
- ✅ 0 orphaned bookings
- ✅ Performance < 10 seconds per booking
- ✅ Positive customer feedback
- ✅ Support tickets < 5 related to combinations

---

## Communication Plan

### Before Deployment

**Audience**: Engineering, Support, Operations  
**Message**: "Deploying table combinations feature - expect multi-table assignments starting [DATE]"  
**Channel**: Slack, Email

### During Deployment

**Audience**: Engineering, Operations  
**Message**: Real-time status updates  
**Channel**: Slack deployment channel

### After Deployment

**Audience**: All stakeholders  
**Message**: "Table combinations deployed successfully - [X]% usage, [Y]% success rate"  
**Channel**: Company-wide update

### If Issues

**Audience**: Engineering, Support, Leadership  
**Message**: "Issue detected with table combinations - [DESCRIPTION] - [ROLLBACK STATUS]"  
**Channel**: Incident channel + Email

---

## Contacts

**Engineering Lead**: [Name/Email]  
**Operations**: [Name/Email]  
**Support**: [Name/Email]  
**On-Call**: [Rotation/Contact]

---

## Appendix

### A. Useful Commands

```bash
# Test feature flags
pnpm tsx -r tsconfig-paths/register scripts/test-feature-flags.ts

# Check combinations
pnpm tsx -r tsconfig-paths/register scripts/check-table-combinations.ts

# Monitor production
pnpm tsx -r tsconfig-paths/register scripts/production-monitor.ts --days=7

# Fix orphaned bookings
pnpm tsx -r tsconfig-paths/register scripts/fix-orphaned-bookings.ts

# Check adjacency data
pnpm tsx -r tsconfig-paths/register scripts/check-adjacency.ts

# Database backup
pnpm supabase db dump -f backups/backup-$(date +%Y%m%d-%H%M%S).sql

# Apply migrations
pnpm supabase db push
```

### B. Related Documentation

- `TABLE_COMBINATIONS_SUMMARY.md` - Comprehensive feature overview
- `TABLE_COMBINATION_RULES.md` - Validation rules reference
- `POPULATING_ADJACENCY_DATA.md` - Guide for adjacency setup
- `.env.example` - Environment variables reference

### C. Version History

| Version | Date       | Changes                    |
| ------- | ---------- | -------------------------- |
| 1.0     | 2025-11-05 | Initial deployment runbook |

---

**Last Updated**: November 5, 2025  
**Next Review**: December 5, 2025
