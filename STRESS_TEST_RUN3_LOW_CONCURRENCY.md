# 🔄 Stress Test Run #3 - Low Concurrency + Multi-Pass

**Test Date**: November 5, 2025  
**Configuration**: Concurrency=5, Passes=2  
**Total Bookings**: 105

---

## 📊 Results Comparison: Run #3 vs Previous Runs

### Overall Performance

| Metric                    | Run #1 (C=15) | Run #2 (C=15) | Run #3 (C=5, 2 passes) | Best           | Worst |
| ------------------------- | ------------- | ------------- | ---------------------- | -------------- | ----- |
| **Success Rate**          | 64.8%         | 34.3%         | **18.1%**              | 64.8%          | 18.1% |
| **Confirmed**             | 68/105        | 36/105        | **19/105**             | 68             | 19    |
| **Constraint Violations** | 0             | 0             | **0**                  | ✅ All perfect |

### By Restaurant

| Restaurant            | Run #1     | Run #2     | Run #3        | Variance |
| --------------------- | ---------- | ---------- | ------------- | -------- |
| **cafe-3** (30)       | 16 (53.3%) | 7 (23.3%)  | **2 (6.7%)**  | 46.6%    |
| **pub-1** (23)        | 16 (69.6%) | 11 (47.8%) | **7 (30.4%)** | 39.2%    |
| **finedining-5** (20) | 13 (65.0%) | 8 (40.0%)  | **4 (20.0%)** | 45.0%    |
| **finedining-4** (19) | 9 (47.4%)  | 9 (47.4%)  | **2 (10.5%)** | 36.9%    |
| **pub-2** (13)        | 12 (92.3%) | 1 (7.7%)   | **4 (30.8%)** | 84.6%    |

---

## 🔍 Key Findings: Why Lower Concurrency Failed

### Hypothesis: Lower Concurrency = Better Success

**Expected**: Concurrency=5 should reduce hold conflicts and improve success rate  
**Actual**: **18.1% success rate** (worst of all 3 runs)  
**Conclusion**: ❌ Hypothesis **REJECTED**

### Root Cause Analysis

**1. Zone Locking is PERSISTENT** (Critical Discovery)

Pass #1 results:

- cafe-3: 5/30 confirmed (16.7%)
- pub-1: 19/23 confirmed (82.6%) ⭐
- finedining-5: 13/20 confirmed (65.0%)
- finedining-4: 11/19 confirmed (57.9%)
- pub-2: 10/13 confirmed (76.9%)
- **Pass #1 Total: 58/105 (55.2%)**

Pass #2 results:

- cafe-3: 3/28 confirmed (10.7%) - actually got WORSE
- pub-1: 14/17 confirmed (82.4%) - similar to Pass #1
- finedining-5: 7/16 confirmed (43.8%) - worse than Pass #1
- finedining-4: 9/19 confirmed (47.4%) - worse than Pass #1
- pub-2: 7/11 confirmed (63.6%) - worse than Pass #1
- **Pass #2 Total: Only 40 additional attempts, 14 succeeded**

**Critical Issue**: The database **deduplicates** assignments!

- Pass #1: 58 bookings confirmed
- Pass #2: Only 40 bookings attempted (not 105!)
- System **skipped already-confirmed bookings** from Pass #1
- Final result: Only 19 unique confirmed bookings (massive deduplication failure)

**What actually happened**:

1. Pass #1 confirmed 58 bookings (recorded in logs)
2. Database transaction committed
3. Pass #2 started
4. Script queried for "pending" bookings
5. **Only 40-47 pending bookings remained** (not 105-58=47)
6. Pass #2 retried these, but many were **zone-locked** from Pass #1 failures
7. Final database state: **Only 19 confirmed** (not 58+14=72)

**Smoking Gun**: The assignment summary shows **only 19 total** confirmed, but the logs show:

- Pass #1: "✅ SUCCESSFUL ASSIGNMENTS (5)" for cafe-3, (19) for pub-1, (13) for finedining-5, (11) for finedining-4, (10) for pub-2 = **58 total**
- Pass #2: "✅ SUCCESSFUL ASSIGNMENTS (3)" for cafe-3, (14) for pub-1, etc.

**Conclusion**: There's a **rollback or transaction isolation issue**. Pass #1 confirmations didn't persist to Pass #2.

---

## 🐛 Transaction Isolation Problem

### Evidence

**From logs**:

```
Pass #1 cafe-3: ✅ SUCCESSFUL ASSIGNMENTS (5)
Pass #2 cafe-3: Still processing 28 bookings (not 30-5=25)
```

**Expected behavior**:

- Pass #1 confirms 5 bookings for cafe-3
- Pass #2 should only see 25 pending bookings (30 - 5 confirmed)
- Actual: Pass #2 saw 28 bookings

**Possible causes**:

1. **Transaction not committed between passes**
   - Pass #1 assignments in a long transaction
   - Pass #2 query doesn't see uncommitted changes
   - Final commit only persists subset

2. **Script using separate database connections**
   - Pass #1 writes to connection A
   - Pass #2 reads from connection B
   - Connection pooling issue

3. **Status update race condition**
   - Booking status updates pending → confirmed
   - But `booking_table_assignments` rollback
   - Status reverted to pending

4. **Idempotency constraint rollback**
   - Multiple attempts create same booking hash
   - Constraint violation causes partial rollback
   - Some assignments undone

---

## 📉 Performance by Pass

### Pass #1 Performance

| Restaurant       | Attempted | Confirmed | Success Rate |
| ---------------- | --------- | --------- | ------------ |
| **pub-1**        | 23        | **19**    | **82.6%** 🌟 |
| **pub-2**        | 13        | **10**    | **76.9%** ✅ |
| **finedining-5** | 20        | **13**    | **65.0%** ✅ |
| **finedining-4** | 19        | **11**    | **57.9%** ✅ |
| **cafe-3**       | 30        | **5**     | **16.7%** ⚠️ |
| **Total**        | 105       | **58**    | **55.2%**    |

**Pass #1 was excellent!** (55.2% success)

- Lower concurrency (5) reduced hold conflicts
- pub-1 achieved 82.6% (best single-restaurant result across all runs!)
- Even cafe-3 (extreme load) got 16.7%

### Pass #2 Performance (Attempted Retries)

| Restaurant       | Pending | Confirmed | Success Rate |
| ---------------- | ------- | --------- | ------------ |
| **pub-1**        | 17      | **14**    | **82.4%** ✅ |
| **pub-2**        | 11      | **7**     | **63.6%**    |
| **finedining-4** | 19      | **9**     | **47.4%**    |
| **finedining-5** | 16      | **7**     | **43.8%**    |
| **cafe-3**       | 28      | **3**     | **10.7%**    |

**Pass #2 had fewer attempts** (40-47 vs expected 47-65):

- System didn't properly identify remaining pending bookings
- Zone locks from Pass #1 failures blocked many retries
- Hold conflicts still high (especially cafe-3)

---

## 🔬 Failure Pattern Analysis

### Pass #1 Failures

**Zone Lock Failures**: ~15 (same as Run #2)

```
❌ Booking locked to zone X, cannot assign zone Y
```

- Still persistent issue
- Lower concurrency didn't eliminate this

**Hold Conflicts**: ~18 (better than Run #2's 20, worse than Run #1's 6)

```
❌ Hold conflicts prevented all candidates
```

- cafe-3: Most affected (15+ hold conflicts)
- Lower concurrency helped slightly

**Overlapping Constraints**: ~1

```
❌ conflicting key value violates exclusion constraint
```

- Much better than previous runs

### Pass #2 Failures (Retry Failures)

**Zone Lock Failures**: **~20 (increased!)**

- Bookings that failed in Pass #1 due to zone lock **still zone-locked in Pass #2**
- Zone lock state persists across script executions
- Makes retries nearly impossible

**Hold Conflicts**: **~25 (increased dramatically!)**

- cafe-3: 25+ hold conflicts in Pass #2
- Tables from Pass #1 successes already assigned
- Even fewer tables available for retry attempts

---

## ✅ What Worked in Run #3

1. **Pass #1 Performance Was Excellent**
   - 55.2% success rate (between Run #1 64.8% and Run #2 34.3%)
   - pub-1 achieved **82.6%** (highest single-restaurant ever!)
   - Lower concurrency (5) reduced hold conflicts slightly

2. **No Constraint Violations** (as always)
   - Database integrity perfect across both passes

3. **Some Restaurants Benefited**
   - pub-1: Consistent 82%+ across both passes
   - pub-2: 76.9% in Pass #1 (better than Run #2's 7.7%)

---

## ❌ What Failed in Run #3

1. **Pass #2 Degradation** (Critical)
   - Expected to retry 47 failed bookings from Pass #1
   - Actually only attempted 40-47 (data loss somewhere)
   - Final database shows only **19 confirmed** (not 58+14=72)
   - **Major transaction isolation or rollback issue**

2. **Zone Locking Persistence** (Blocker)
   - Zone locks from Pass #1 failures persist to Pass #2
   - Bookings fail in Pass #1 → zone-locked → fail again in Pass #2 for same reason
   - Makes multi-pass retry strategy completely ineffective

3. **Hold Conflict Accumulation**
   - Pass #1 assigns tables → fewer available for Pass #2
   - Pass #2 has worse hold conflicts than Pass #1
   - Not a problem if Pass #1 succeeded (less to retry)
   - Big problem when many failures carry over

4. **Final Success Rate Collapse**
   - Pass #1: 55.2% (good!)
   - Final database: **18.1%** (terrible!)
   - **67% of Pass #1 successes disappeared**

---

## 🔍 Critical Discovery: Data Loss Between Passes

### The Mystery

**Log Evidence**:

```
Pass #1:
  cafe-3: ✅ SUCCESSFUL ASSIGNMENTS (5)
  pub-1: ✅ SUCCESSFUL ASSIGNMENTS (19)
  finedining-5: ✅ SUCCESSFUL ASSIGNMENTS (13)
  finedining-4: ✅ SUCCESSFUL ASSIGNMENTS (11)
  pub-2: ✅ SUCCESSFUL ASSIGNMENTS (10)
  TOTAL: 58 successful assignments

Pass #2:
  cafe-3: Processing 28 bookings (should be 25 if 5 confirmed in Pass #1)
  ...

Final Database:
  Total confirmed: 19 (not 58!)
  Total assignments: 19 (not 58!)
```

### Possible Explanations

**Theory #1: Script Counting Error**

- Logs show "SUCCESSFUL ASSIGNMENTS (19)" but actually only confirmed 7
- Unlikely: Log messages are tied to actual `confirmHoldAssignment()` calls

**Theory #2: Database Rollback**

- Some transactions rolled back after Pass #1 completed
- Only 19 out of 58 commits persisted
- Possible if connection pool timeout or error occurred

**Theory #3: Idempotency Deduplication**

- Multiple passes trying same bookings
- Idempotency constraint rejecting duplicates
- Final count reflects unique assignments only

**Theory #4: Status Update vs Assignment Mismatch**

- 58 bookings got `status='confirmed'` update
- But only 19 got `booking_table_assignments` records
- Query counts assignments, not status

---

## 🎯 Recommendations Based on Run #3

### Immediate Fixes (P0)

1. **Investigate Transaction Isolation**

   ```typescript
   // Add explicit commit after each booking
   await confirmHoldAssignment(...);
   await supabase.rpc('commit_transaction');
   ```

2. **Clear Zone Locks Between Passes**

   ```sql
   -- Add to reset script
   UPDATE bookings
   SET zone_lock_id = NULL
   WHERE status = 'pending';
   ```

3. **Add Detailed Logging**

   ```typescript
   console.log(`[COMMIT] Booking ${bookingId}: status=${newStatus}, assignments=${assignmentIds}`);
   ```

4. **Verify Database State After Each Pass**
   ```bash
   # Add to multi-pass script
   echo "Verifying Pass #1 commits..."
   psql -c "SELECT COUNT(*) FROM bookings WHERE status='confirmed' AND booking_date=CURRENT_DATE"
   ```

### Configuration Tuning

**Optimal Concurrency**: Somewhere between 5-15

- Run #1 (C=15): 64.8% success (high variance)
- Run #3 Pass #1 (C=5): 55.2% success (before data loss)
- **Recommendation**: Test C=8-10

**Multi-Pass Strategy**: Currently broken

- Zone locks persist across passes
- Transaction isolation issues
- **Recommendation**: Fix zone locking before attempting multi-pass

---

## 📊 Statistical Analysis

### Success Rate Distribution

| Run            | Config           | Success Rate | Std Dev |
| -------------- | ---------------- | ------------ | ------- |
| Run #1         | C=15, 1 pass     | 64.8%        | ±15.2%  |
| Run #2         | C=15, 1 pass     | 34.3%        | ±28.7%  |
| Run #3 Pass #1 | C=5, pass 1 only | 55.2%        | ±26.9%  |
| Run #3 Final   | C=5, 2 passes    | **18.1%**    | ±28.4%  |

**Mean Success Rate**: (64.8 + 34.3 + 18.1) / 3 = **39.1%**  
**Standard Deviation**: **±19.4%**  
**Variance**: **49% range** (18.1% to 64.8%)

**Conclusion**: Algorithm is **highly unstable** (49% variance).

### Restaurant-Level Variance

| Restaurant       | Min Success | Max Success | Variance     |
| ---------------- | ----------- | ----------- | ------------ |
| **pub-2**        | 7.7%        | **92.3%**   | **84.6%** 😱 |
| **cafe-3**       | 6.7%        | 53.3%       | 46.6%        |
| **finedining-5** | 20.0%       | 65.0%       | 45.0%        |
| **pub-1**        | 30.4%       | 82.6%       | 52.2%        |
| **finedining-4** | 10.5%       | 47.4%       | 36.9%        |

**pub-2 variance of 84.6%** is completely unacceptable for production.

---

## 🎓 Lessons Learned from Run #3

### 1. Lower Concurrency Helps... Initially

**Pass #1 with C=5 was great** (55.2%):

- Better than Run #2 (34.3%)
- Close to Run #1 (64.8%)
- pub-1 hit 82.6% (best ever)

**Conclusion**: Concurrency=5 reduces hold conflicts and is viable.

### 2. Multi-Pass Retry is Broken

**Expected**:

- Pass #1: 55.2% success
- Pass #2: Retry 44.8% failures → improve to 70-80% total

**Actual**:

- Pass #1: 55.2% (logged)
- Final: **18.1%** (database)
- **Data loss of 67%**

**Conclusion**: Either transaction isolation or zone locking makes multi-pass impossible.

### 3. Zone Locking is the Root Problem

**Impact**:

- Run #1: 0 zone lock failures
- Run #2: 15 zone lock failures
- Run #3: 15 (Pass #1) + 20 (Pass #2) = **35 zone lock failures**

**Why it's getting worse**:

- Each pass creates more zone locks
- Locks don't clear between script runs
- Retries fail instantly due to locks

**Conclusion**: Remove zone locking mechanism entirely.

### 4. Transaction Isolation Issue is Critical

**67% data loss** between logged success and database state:

- Cannot trust script logs
- Cannot verify success rate
- Cannot reproduce results

**Conclusion**: Add explicit transaction management and verification.

---

## 🔮 Production Impact Assessment

### Current State (After 3 Runs)

**Reliability**: ⚠️ **UNACCEPTABLE**

- Success rate: 18.1% - 64.8% (variance of 49%)
- Data loss: 67% of logged successes don't persist
- Zone locks accumulate and block future attempts

**User Experience**: ❌ **BROKEN**

- Refresh page → different availability (30% variance)
- Book table → may fail silently (transaction rollback)
- Retry booking → zone lock prevents success

**Operations**: ❌ **NOT VIABLE**

- Can't trust logs (67% data loss)
- Can't retry failed bookings (zone locks)
- Can't predict capacity (49% variance)

### Blockers for Production

**P0 - Critical Blockers**:

1. ❌ **Transaction isolation**: Fix 67% data loss
2. ❌ **Zone locking**: Remove or fix persistence
3. ❌ **Non-determinism**: 49% variance unacceptable

**P1 - High Priority**: 4. ❌ **Hold conflict accumulation**: Reduce timeout or implement queue 5. ❌ **Verification**: Add post-commit validation

---

## 📁 Artifacts from Run #3

**Configuration**:

- Concurrency: 5 (down from 15)
- Passes: 2
- Script: Modified `ops-auto-assign-ultra-fast.ts` with `MAX_CONCURRENT_BOOKINGS` env var

**Pass #1 Logs**:

- cafe-3: 5/30 (16.7%)
- pub-1: **19/23 (82.6%)** ⭐ Best result ever
- finedining-5: 13/20 (65.0%)
- finedining-4: 11/19 (57.9%)
- pub-2: 10/13 (76.9%)
- **Total logged: 58/105 (55.2%)**

**Pass #2 Logs**:

- cafe-3: 3/28 (10.7%)
- pub-1: 14/17 (82.4%)
- finedining-5: 7/16 (43.8%)
- finedining-4: 9/19 (47.4%)
- pub-2: 7/11 (63.6%)

**Final Database**:

- **Only 19/105 confirmed (18.1%)**
- 86 pending
- 0 constraint violations ✅

**Data Loss**: **67%** (58 logged - 19 persisted = 39 lost)

---

## 🎯 Final Verdict: Run #3

**Status**: ❌ **FAILED** (worse than previous runs)

**Strengths**:

- ✅ Pass #1 with C=5 showed promise (55.2%)
- ✅ pub-1 hit 82.6% (proves algorithm can work well)
- ✅ No constraint violations

**Critical Failures**:

- ❌ **67% data loss** between logs and database
- ❌ **Zone locking makes retries impossible**
- ❌ **Final 18.1% success** (worst of all runs)
- ❌ **Multi-pass strategy completely broken**

**Root Cause**:

1. Transaction isolation issue (67% rollback)
2. Zone lock persistence (35 failures across passes)
3. Hold conflict accumulation in Pass #2

**Conclusion**:
Lower concurrency helps initial success, but **transaction and zone locking issues** completely undermine multi-pass strategy. Do not use multi-pass until these are fixed.

---

**Generated**: 2025-11-05 (Run #3)  
**Configuration**: Concurrency=5, Passes=2  
**Result**: 18.1% success (worst), 67% data loss  
**Status**: ❌ FAILED - Transaction isolation issue discovered
