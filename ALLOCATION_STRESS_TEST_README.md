# Allocation Algorithm Stress Test - Complete Guide

## 🎯 Overview

This stress test suite validates your table allocation algorithm with **105 realistic bookings** across 5 restaurants with 90 tables. All data is generated directly from your database schema ensuring 100% compatibility.

## ✅ What's Been Done

### 1. Fixed Intelligent Seed Generator

- ✅ Aligned all column names with actual schema
- ✅ Fixed foreign key dependencies (allowed_capacities before tables)
- ✅ Added lifecycle constraints (checked_in_at/checked_out_at for completed bookings)
- ✅ Generates 5 restaurants, 90 tables, 500 customers, 250 historical bookings

### 2. Created Today's Bookings Generator

- ✅ Generates 100 bookings for TODAY across all restaurants
- ✅ Realistic time distribution (30% lunch, 10% drinks, 60% dinner)
- ✅ Realistic party size distribution (40% 2-tops, 30% 4-tops, etc.)
- ✅ All bookings in 'confirmed' status ready for allocation

### 3. Created Stress Test Validation Suite

- ✅ Pre-allocation constraint validation
- ✅ Post-allocation performance metrics
- ✅ Time conflict detection
- ✅ Capacity violation checks
- ✅ Resource utilization analysis

## 📊 Current Database State

```
Restaurants:        5
Tables:            90
Customers:        500
Total Bookings:   250
Today's Bookings: 105 ✅
Table Adjacencies: 77
```

### Today's Booking Distribution

**By Type:**

- Dinner: 66 bookings (63%)
- Lunch: 32 bookings (30%)
- Drinks: 7 bookings (7%)

**By Party Size:**

- 2-tops: 45 bookings
- 4-tops: 31 bookings
- 6-tops: 14 bookings
- 3-tops: 11 bookings
- 8-tops: 4 bookings

**Peak Hour:** 19:00 with 27 bookings

**Busiest Restaurant:** Cafe 3 with 30 bookings (167% of table capacity)

## 🚀 Quick Start

### Step 1: Generate Base Data (if needed)

```bash
pnpm run db:reset
pnpm run db:seed-intelligent
```

### Step 2: Add Today's Bookings

```bash
pnpm run db:seed-today
```

### Step 3: Validate Pre-Allocation State

```bash
pnpm run db:stress-test
```

### Step 4: Run Your Allocation Algorithm

```bash
# Option A: Use the automated test runner
pnpm run db:run-allocation-test

# Option B: Run manually for specific restaurant
pnpm run assign:loop -- --slug cafe-3 --date $(date +%Y-%m-%d)
```

### Step 5: Validate Post-Allocation

```bash
pnpm run db:stress-test
```

## 📋 Available Commands

| Command                           | Purpose                                                  |
| --------------------------------- | -------------------------------------------------------- |
| `pnpm run db:seed-intelligent`    | Generate base seed data (restaurants, tables, customers) |
| `pnpm run db:seed-today`          | Add 100 bookings for today                               |
| `pnpm run db:stress-test`         | Run validation suite                                     |
| `pnpm run db:run-allocation-test` | Run allocation + validation (full test)                  |

## 🎯 Stress Test Scenarios

### Scenario 1: High Load Restaurant

**Cafe 3** has 30 bookings with only ~18 tables

- Tests: Multi-table assignments, optimal packing
- Challenge: 167% capacity utilization required

### Scenario 2: Large Parties

4 parties of 8 guests + 14 parties of 6 guests

- Tests: Table combinations, adjacency rules
- Challenge: Limited large table availability

### Scenario 3: Peak Hour Concurrency

27 bookings at 19:00 across all restaurants

- Tests: Parallel allocation, conflict avoidance
- Challenge: Multiple overlapping time slots

### Scenario 4: Mixed Party Sizes

45 2-tops, 31 4-tops, varying other sizes

- Tests: Efficient table selection
- Challenge: Avoid blocking larger tables for small parties

## 📈 Expected Performance Targets

| Metric                  | Target  | Why                             |
| ----------------------- | ------- | ------------------------------- |
| Allocation Success Rate | ≥ 90%   | Some conflicts expected at peak |
| Average Allocation Time | < 100ms | Per booking                     |
| Table Utilization       | ≥ 70%   | Efficient resource usage        |
| Multi-Table Assignments | 10-15%  | For large parties               |
| Constraint Violations   | 0       | Hard requirement                |

## 🔍 Validation Checks

The stress test validates:

✅ **No time conflicts** - Overlapping bookings on same table  
✅ **No capacity violations** - Party size within table limits  
✅ **No duplicate assignments** - Each booking-table pair unique  
✅ **Lifecycle consistency** - Booking statuses match timestamps  
✅ **Referential integrity** - All foreign keys valid

## 📊 Post-Allocation Metrics

After running allocation, check:

1. **Allocation Success Rate**

   ```sql
   SELECT
     COUNT(*) FILTER (WHERE allocated) * 100.0 / COUNT(*) as success_rate
   FROM bookings WHERE booking_date = CURRENT_DATE;
   ```

2. **Table Utilization**

   ```sql
   SELECT
     COUNT(DISTINCT table_id) * 100.0 / 90 as utilization
   FROM booking_table_assignments;
   ```

3. **Average Allocation Time**
   - Check application logs for per-booking timing
   - Target: < 100ms per booking

## 🐛 Troubleshooting

### No bookings generated?

```bash
# Check if today's seed ran
source .env.local
psql "$SUPABASE_DB_URL" -c "SELECT COUNT(*) FROM bookings WHERE booking_date = CURRENT_DATE;"
```

### Allocation failing?

```bash
# Check for existing assignments blocking
pnpm run db:stress-test

# Clear today's assignments if needed
source .env.local
psql "$SUPABASE_DB_URL" -c "DELETE FROM booking_table_assignments WHERE booking_id IN (SELECT id FROM bookings WHERE booking_date = CURRENT_DATE);"
```

### Want to start fresh?

```bash
# Full reset
pnpm run db:reset
pnpm run db:seed-intelligent
pnpm run db:seed-today
```

## 📁 Files Created

| File                                        | Purpose                    |
| ------------------------------------------- | -------------------------- |
| `supabase/seeds/intelligent-seed.sql`       | Base seed data generator   |
| `supabase/seeds/today-bookings-seed.sql`    | Today's bookings generator |
| `supabase/seeds/stress-test-allocation.sql` | Validation test suite      |
| `scripts/run-allocation-stress-test.sh`     | Automated test runner      |
| `STRESS_TEST_SUMMARY.md`                    | Detailed analysis          |
| `ALLOCATION_STRESS_TEST_README.md`          | This file                  |

## 🎓 Understanding the Data

### Why 105 bookings?

- 100 from today's seed script
- 5 from base intelligent seed (some overlap with today)
- Realistic load for 5 restaurants (avg 21 bookings each)

### Why mixed party sizes?

- Mirrors real-world distribution
- Tests algorithm's ability to optimize table selection
- Challenges both small and large table allocation

### Why peak at 19:00?

- Realistic dinner rush pattern
- Maximum concurrency stress test
- Tests conflict resolution

## 🚀 Next Steps

1. **Run the full test:** `pnpm run db:run-allocation-test`
2. **Analyze results:** Check success rate, utilization, violations
3. **Optimize:** Improve algorithm based on bottlenecks
4. **Repeat:** Re-run with fresh data to validate improvements

## 📞 Support

All seed scripts are database-driven and schema-compliant. If you encounter errors:

1. Check schema migrations are up-to-date: `pnpm run db:status`
2. Verify environment variables: `pnpm run validate:env`
3. Review error messages for constraint violations

---

**Ready to stress test! 🎯**
