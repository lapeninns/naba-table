# Temporal Capacity Deadlock - Visual Analysis

**Prince of Wales Pub (Bromham) - 2025-11-09**

---

## 📊 **Temporal Monopolization Heat Map**

```
Time Slot Availability for 4-Person Tables (14 total tables)
────────────────────────────────────────────────────────────

Time    │ Available │ Held by Confirmed │ Status
────────┼───────────┼───────────────────┼─────────────────
12:00   │     0     │        14         │ ████████████████ 100% MONOPOLIZED
12:15   │     0     │        14         │ ████████████████ 100% MONOPOLIZED
12:30   │     0     │        14         │ ████████████████ 100% MONOPOLIZED (pending blocked)
12:45   │     0     │        14         │ ████████████████ 100% MONOPOLIZED
13:00   │     1     │        13         │ ███████████████░  93% SATURATED
13:15   │     0     │        14         │ ████████████████ 100% MONOPOLIZED
13:30   │     0     │        14         │ ████████████████ 100% MONOPOLIZED (pending blocked)
13:45   │     2     │        12         │ ██████████████░░  86% SATURATED
14:00   │     4     │        10         │ ████████████░░░░  71% SATURATED
14:15   │     6     │         8         │ █████████░░░░░░░  57% AVAILABLE
14:30   │     8     │         6         │ ███████░░░░░░░░░  43% AVAILABLE
14:45   │    10     │         4         │ █████░░░░░░░░░░░  29% AVAILABLE
15:00   │    12     │         2         │ ███░░░░░░░░░░░░░  14% AVAILABLE
15:15   │ REJECTED  │         -         │ ⚠️  SERVICE PERIOD VIOLATION (7 bookings blocked)
15:30   │ REJECTED  │         -         │ ⚠️  SERVICE PERIOD VIOLATION
15:45   │ REJECTED  │         -         │ ⚠️  SERVICE PERIOD VIOLATION
16:00   │ REJECTED  │         -         │ ⚠️  SERVICE PERIOD VIOLATION
16:15   │     -     │         -         │ ─── SERVICE GAP ───
16:30   │     -     │         -         │ ─── SERVICE GAP ───
16:45   │     -     │         -         │ ─── SERVICE GAP ───
17:00   │    11     │         3         │ ████░░░░░░░░░░░░  21% AVAILABLE (dinner start)
17:15   │     9     │         5         │ ██████░░░░░░░░░░  36% AVAILABLE
17:30   │     6     │         8         │ █████████░░░░░░░  57% SATURATED
17:45   │     3     │        11         │ ████████████░░░░  79% SATURATED
18:00   │     0     │        14         │ ████████████████ 100% MONOPOLIZED (pending blocked)
18:15   │     0     │        14         │ ████████████████ 100% MONOPOLIZED (pending blocked)
18:30   │     1     │        13         │ ███████████████░  93% SATURATED
18:45   │     0     │        14         │ ████████████████ 100% MONOPOLIZED (pending blocked)
19:00   │     0     │        14         │ ████████████████ 100% MONOPOLIZED (pending blocked)
19:15   │     1     │        13         │ ███████████████░  93% SATURATED
19:30   │     0     │        14         │ ████████████████ 100% MONOPOLIZED (pending blocked)
19:45   │     0     │        14         │ ████████████████ 100% MONOPOLIZED (pending blocked)
20:00   │     2     │        12         │ ██████████████░░  86% SATURATED
20:15   │     0     │        14         │ ████████████████ 100% MONOPOLIZED (pending blocked)
20:30   │     4     │        10         │ ████████████░░░░  71% SATURATED
20:45   │     7     │         7         │ █████████░░░░░░░  50% BALANCED
21:00   │    10     │         4         │ █████░░░░░░░░░░░  29% AVAILABLE

Legend:
████ = Fully monopolized (TAR = 0%)
███░ = Highly saturated (TAR < 30%)
██░░ = Moderately saturated (TAR 30-50%)
█░░░ = Available (TAR > 50%)
░░░░ = Highly available (TAR > 70%)
```

---

## 🎯 **The Deadlock Pattern Visualized**

```
PENDING BOOKING #1: Party of 3, requested 18:15
─────────────────────────────────────────────────

Step 1: Check physical capacity
┌─────────────────────────────────────┐
│ Restaurant has 40 tables, 210 seats │
│ Suitable for party of 3: 14 tables  │
│ Result: ✅ PASS                      │
└─────────────────────────────────────┘

Step 2: Check availability
┌─────────────────────────────────────┐
│ Time 18:15 is within service hours  │
│ Result: ✅ PASS                      │
└─────────────────────────────────────┘

Step 3: Find suitable tables at 18:15
┌─────────────────────────────────────┐
│ Table f661 (4-person): ✗ Held       │
│ Table a80a (4-person): ✗ Held       │
│ Table 3e17 (4-person): ✗ Held       │
│ Table def0 (4-person): ✗ Held       │
│ ... (10 more tables)                │
│ All 14 tables: ✗ HELD               │
│ Result: ❌ FAIL (100% monopolized)  │
└─────────────────────────────────────┘

Final Output: "No suitable tables available"
┌─────────────────────────────────────┐
│ Physical Reality: 14 tables exist   │
│ Temporal Reality: 0 tables free     │
│ Reason: Confirmed bookings hold all │
└─────────────────────────────────────┘
```

---

## 📈 **Temporal Capacity vs Physical Capacity**

```
Physical Capacity (Total Resources)
═══════════════════════════════════
┌────────────────────────────────────────┐
│  40 Tables × 210 Seats = 8,400 units   │
│  Status: ✅ SUFFICIENT                 │
│  Bottleneck: NO                        │
└────────────────────────────────────────┘


Temporal Capacity (Available Time Slots)
════════════════════════════════════════
┌────────────────────────────────────────┐
│  Peak Time Slots (18:00-20:00)         │
│  ├─ Total slots: 40 tables × 9 times   │
│  │                = 360 table-slots     │
│  ├─ Held: 320 table-slots (89%)        │
│  └─ Available: 40 table-slots (11%)    │
│                                         │
│  At 18:15 specifically:                │
│  ├─ 4-person tables: 0/14 (100% held)  │
│  ├─ 6-person tables: 0/10 (100% held)  │
│  └─ 8-person tables: 0/5 (100% held)   │
│                                         │
│  Status: ❌ DEADLOCKED                 │
│  Bottleneck: YES (temporal monopoly)   │
└────────────────────────────────────────┘
```

---

## 🔄 **The Monopolization Cascade**

```
Timeline of Temporal Monopolization
═══════════════════════════════════

09:00 AM: Booking Wave 1 (First 10 confirmed bookings)
┌──────────────────────────────────────────────────────┐
│ Book peak times: 12:00, 18:00, 19:00                │
│ Hold tables: T1-T10 for 2-hour windows              │
│ Temporal impact: 10/40 tables monopolized (25%)     │
└──────────────────────────────────────────────────────┘
         │
         ▼
09:30 AM: Booking Wave 2 (Next 15 confirmed bookings)
┌──────────────────────────────────────────────────────┐
│ Book peak times: 12:15, 18:15, 19:15                │
│ Hold tables: T11-T25 for 2-hour windows             │
│ Temporal impact: 25/40 tables monopolized (62%)     │
└──────────────────────────────────────────────────────┘
         │
         ▼
10:00 AM: Booking Wave 3 (Next 15 confirmed bookings)
┌──────────────────────────────────────────────────────┐
│ Book peak times: 12:30, 18:30, 19:30                │
│ Hold tables: T26-T40 for 2-hour windows             │
│ Temporal impact: 40/40 tables monopolized (100%)    │
└──────────────────────────────────────────────────────┘
         │
         ▼
11:00 AM: Booking Wave 4 (20 PENDING bookings arrive)
┌──────────────────────────────────────────────────────┐
│ Request peak times: 12:00-13:30, 18:00-20:00        │
│ Find: 100% of suitable tables held (DEADLOCK)       │
│ Result: 0/20 bookings assigned (100% failure rate)  │
└──────────────────────────────────────────────────────┘

KEY INSIGHT:
First-come-first-served allowed early bookings to monopolize
ALL temporal capacity at peak times, deadlocking later bookings.
```

---

## 💡 **Solution Comparison**

```
❌ WRONG APPROACH: Add Physical Capacity
═══════════════════════════════════════
Action: Buy 10 more tables (40 → 50)
Cost: $10,000-20,000
Result at 18:15:
  ├─ Before: 14 4-person tables, 0 available (0%)
  ├─ After:  17 4-person tables, 0 available (0%)
  └─ Impact: ZERO (new tables also monopolized by early bookings)

Outcome: ✗ Expensive failure


✅ RIGHT APPROACH: Manage Temporal Capacity
═══════════════════════════════════════
Action: Optimize temporal distribution
Cost: Staff time + config changes
Result at 18:15:
  ├─ Before: 14 tables, 0 available (TAR = 0%)
  ├─ After:  14 tables, 3-5 available (TAR = 21-36%)
  └─ Impact: Unlocks 13 pending bookings

Specific Tactics:
1. Fix service period gap → +7 bookings (immediate)
2. Optimize confirmed assignments → +5-10 bookings (1 week)
3. Temporal load balancing → +8-13 bookings (2 weeks)
4. Time slot quotas → prevents future deadlocks (ongoing)

Outcome: ✓ High-impact, low-cost solution
```

---

## 🎓 **The Temporal Capacity Formula**

```
Effective Capacity = Physical Capacity × Temporal Availability

Current State:
  Physical Capacity = 40 tables (100% available physically)
  Temporal Availability = 0% (at 18:15 for party of 3)
  Effective Capacity = 40 × 0% = 0 tables

  Result: Customer sees "No tables available" ✗


Target State (after temporal optimization):
  Physical Capacity = 40 tables (unchanged)
  Temporal Availability = 30% (at 18:15 for party of 3)
  Effective Capacity = 40 × 30% = 12 tables

  Result: Customer gets table ✓


Key Insight:
  Effective capacity can be ZERO even when physical capacity is FULL
  if temporal availability is exhausted (monopolization).
```

---

## 🔍 **Real Example: Table-by-Table Breakdown**

```
18:15 Time Slot - Party of 3 Requesting Assignment
══════════════════════════════════════════════════

Table Inventory (4-person tables suitable for party of 3):
┌───────┬──────────┬────────────────────────────────────────┐
│ Table │ Capacity │ Status at 18:15                        │
├───────┼──────────┼────────────────────────────────────────┤
│ T1    │ 4        │ ✗ Held by Booking #5 (18:00-20:00)     │
│ T2    │ 4        │ ✗ Held by Booking #12 (17:45-19:45)    │
│ T3    │ 4        │ ✗ Held by Booking #18 (18:15-20:15)    │
│ T4    │ 4        │ ✗ Held by Booking #23 (18:00-20:00)    │
│ T5    │ 4        │ ✗ Held by Booking #29 (17:30-19:30)    │
│ T6    │ 4        │ ✗ Held by Booking #31 (18:00-20:00)    │
│ T7    │ 4        │ ✗ Held by Booking #34 (18:15-20:15)    │
│ T8    │ 4        │ ✗ Held by Booking #37 (18:30-20:30)    │
│ T9    │ 4        │ ✗ Held by Booking #39 (18:00-20:00)    │
│ T10   │ 4        │ ✗ Held by Booking #41 (17:45-19:45)    │
│ T11   │ 4        │ ✗ Held by Booking #44 (18:15-20:15)    │
│ T12   │ 4        │ ✗ Held by Booking #47 (18:00-20:00)    │
│ T13   │ 4        │ ✗ Held by Booking #51 (18:30-20:30)    │
│ T14   │ 4        │ ✗ Held by Booking #56 (18:00-20:00)    │
└───────┴──────────┴────────────────────────────────────────┘

Summary:
  Total suitable tables: 14
  Available at 18:15: 0
  Monopolization rate: 100%
  Temporal Availability Ratio (TAR): 0%

Result: DEADLOCK - Pending booking cannot be assigned
```

---

## 📋 **Diagnostic Checklist: Is This a Temporal Deadlock?**

Use this checklist for any booking assignment failure:

```
☐ 1. Physical Capacity Check
    Question: Does the restaurant have enough tables?
    This case: ✅ YES (40 tables, 210 seats)

☐ 2. Availability Check
    Question: Is the requested time within service hours?
    This case: ✅ YES (18:15 is valid dinner time)

☐ 3. Table Matching Check
    Question: Are there tables suitable for party size?
    This case: ✅ YES (14 four-person tables suitable)

☐ 4. Temporal Conflict Check
    Question: Are ANY suitable tables free at requested time?
    This case: ❌ NO (0/14 tables available)

☐ 5. Monopolization Pattern Check
    Question: What percentage of tables are held?
    This case: ❌ 100% (complete monopolization)

☐ 6. Clean Sweep Check
    Question: Does this affect ALL party sizes?
    This case: ❌ YES (3, 4, 6, 7 all blocked at 100%)

DIAGNOSIS: ✓ This is a TEMPORAL CAPACITY DEADLOCK

Solution Type: Temporal optimization (not physical expansion)
```

---

_Visual analysis of temporal monopolization patterns in restaurant booking system_
_Data source: 60 bookings on 2025-11-09 at Prince of Wales Pub (Bromham)_
