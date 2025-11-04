# Auto-Assignment Analysis Report

**Date**: 2025-11-09  
**Restaurant**: Prince of Wales Pub (Bromham)  
**Total Bookings**: 60  
**Generated**: 2025-11-04

---

## Executive Summary

✅ **Pre-Confirmed Bookings**: 37 confirmed + 3 checked-in = **40 bookings** (67%)  
❌ **Failed Assignments**: **20 bookings** (33%)  
🔄 **New Assignments by Script**: **0 bookings**

> **Key Finding**: All "confirmed" bookings were **already confirmed BEFORE** this script ran. The script did NOT assign any new tables. The 20 "pending" bookings could not be assigned due to specific constraints.

---

## Detailed Failure Analysis

### Category 1: Service Period Constraint (7 failures)

**Reason**: `"Reservation would overrun lunch service (end 15:00)"`

These bookings are scheduled at **16:00** (4:00 PM) but the restaurant's **lunch service ends at 15:00** (3:00 PM). The system blocks assignments that would extend beyond the lunch period boundary.

| Booking ID                           | Time  | Party Size | Issue                       |
| ------------------------------------ | ----- | ---------- | --------------------------- |
| 5fb0cdb6-5251-49b5-a874-00f8a55d642e | 16:00 | 2          | Overruns lunch (ends 15:00) |
| 4d8b249e-d1aa-4fdd-b5b2-e69a8d54a5b8 | 15:15 | 5          | Overruns lunch (ends 15:00) |
| 2325bc20-fd21-4c95-8d92-de83cbcd5fd5 | 16:00 | 2          | Overruns lunch (ends 15:00) |
| 40bcba60-c432-43c0-b467-3a3f228cb4ca | 15:15 | 5          | Overruns lunch (ends 15:00) |
| e626e321-bb40-48da-beb1-32afca97c00c | 16:00 | 2          | Overruns lunch (ends 15:00) |
| 75ea0882-eccf-46b8-b6a8-cf4877508f59 | 15:15 | 5          | Overruns lunch (ends 15:00) |
| 9d91eea0-dbe0-4824-86a6-5fb8071ee172 | 16:00 | 2          | Overruns lunch (ends 15:00) |

**Root Cause**: These bookings fall in a **service period gap**:

- Lunch service ends: 15:00
- Dinner service likely starts: 17:00+
- Bookings at 15:15-16:00 would require tables to be held during the transition

**Recommendation**:

1. Extend lunch service end time to 16:00, OR
2. Start dinner service earlier at 15:00, OR
3. Create a transition period that allows bookings from 15:00-17:00

---

### Category 2: Table Conflicts / Capacity Exhaustion (13 failures)

**Reason**: `"No suitable tables available"` - All candidate tables have "Conflicts with existing holds"

These bookings failed because ALL suitable tables were already held by other bookings at the same time.

#### Party Size 3 (4 failures)

| Booking ID                           | Time  | Candidates Skipped | Issue              |
| ------------------------------------ | ----- | ------------------ | ------------------ |
| 15eb309e-e5b9-4d83-9374-e9edb3b86f3d | 18:15 | 14 tables          | All have conflicts |
| b025f5aa-291f-48d9-a3fb-13151ff1e144 | 19:45 | 14 tables          | All have conflicts |
| ef9fdd2f-b64c-43b8-8a50-aec029ed0f4b | 18:45 | 14 tables          | All have conflicts |
| 14398a68-4a67-4938-9f2b-9cd7b72a082a | 20:15 | 14 tables          | All have conflicts |

#### Party Size 4 (3 failures)

| Booking ID                           | Time  | Candidates Skipped | Issue              |
| ------------------------------------ | ----- | ------------------ | ------------------ |
| f07601f0-50a3-445d-9b5b-8a83178c69aa | 12:30 | 24 tables          | All have conflicts |
| 6b3b1bbf-4eef-4f30-9d9d-3246ca89444f | 12:00 | 24 tables          | All have conflicts |
| 29406430-a51f-4b3c-8553-ff2e6e76e5bc | 13:30 | 24 tables          | All have conflicts |

#### Party Size 6 (3 failures)

| Booking ID                           | Time  | Candidates Skipped | Issue              |
| ------------------------------------ | ----- | ------------------ | ------------------ |
| 9a217d0e-1d4f-41d8-8966-c73508a2f627 | 19:00 | 16 tables          | All have conflicts |
| 073261d1-a618-41d5-af5f-c4e76c97ed8d | 18:00 | 16 tables          | All have conflicts |
| b01815cc-279e-4586-b358-3688675f50b4 | 19:30 | 16 tables          | All have conflicts |

#### Party Size 7 (3 failures)

| Booking ID                           | Time  | Candidates Skipped | Issue              |
| ------------------------------------ | ----- | ------------------ | ------------------ |
| 068e2ab9-0605-4fa0-8732-ea56380e835c | 13:15 | 5 tables           | All have conflicts |
| f759f4ad-50b8-4298-aa7d-14d83dee4638 | 12:45 | 5 tables           | All have conflicts |
| a9ab645e-a0bf-458f-b9b3-64cafca2e33c | 12:15 | 5 tables           | All have conflicts |

**Root Cause**: High booking density + limited table inventory

- Restaurant has: **40 tables, 210 seats**
  - 7 tables of 2-person capacity
  - 14 tables of 4-person capacity
  - 10 tables of 6-person capacity
  - 5 tables of 8-person capacity
  - 4 tables of 10-person capacity

**Why Conflicts Occur**:

1. **Time Overlap**: These bookings are scheduled when 40 other bookings already have table holds
2. **Capacity Matching**: System tried 5-24 different table combinations per booking but all were blocked
3. **Seating Efficiency**: For party size 7, only 5 candidate tables exist (8-person or 10-person tables)

**Recommendations**:

1. **Review Confirmed Bookings**: Some of the 40 "confirmed" bookings may have been manually confirmed without proper table assignments
2. **Stagger Times**: Adjust booking times to reduce overlap (e.g., shift some 12:00-13:30 bookings)
3. **Increase Capacity**: Add more large tables (8+ capacity) to handle parties of 6-7
4. **Manual Assignment**: These 13 bookings need manual table allocation by reviewing actual holds

---

## Restaurant Capacity Overview

```
Total Tables: 40
Total Seats: 210

Table Distribution:
├── 2-person: 7 tables (14 seats)
├── 4-person: 14 tables (56 seats)
├── 6-person: 10 tables (60 seats)
├── 8-person: 5 tables (40 seats)
└── 10-person: 4 tables (40 seats)
```

**Capacity Utilization**: With 60 bookings on 2025-11-09, the restaurant is operating at **very high density**. Average party size appears to be 4-5 people.

---

## Validation Results for Confirmed Bookings

⚠️ **Critical Issue Discovered**: All 40 bookings marked as "confirmed" or "checked_in" show **0 table assignments** in the `booking_table_assignments` table.

This indicates one of three scenarios:

1. **Tables were assigned via a different mechanism** (e.g., `allocations` table instead of `booking_table_assignments`)
2. **Manual confirmations** without table assignments
3. **Data integrity issue** where assignments were deleted

**Recommendation**: Query the `allocations` table directly to verify if these bookings have table holds:

```sql
SELECT
  b.id,
  b.booking_time,
  b.party_size,
  b.status,
  COUNT(a.id) as allocation_count
FROM bookings b
LEFT JOIN allocations a ON b.id = a.booking_id
WHERE b.booking_date = '2025-11-09'
  AND b.restaurant_id = '0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a'
  AND b.status IN ('confirmed', 'checked_in')
GROUP BY b.id
ORDER BY b.booking_time;
```

---

## Action Items

### Immediate (Priority 1)

1. ✅ **Verify Table Assignments**: Check `allocations` table for confirmed bookings
2. ⚠️ **Service Period Configuration**: Fix lunch/dinner gap (15:00-17:00)
3. 🔴 **Manual Assignment Required**: 13 bookings need tables assigned

### Short-term (Priority 2)

1. **Review Booking Density**: 60 bookings for 40 tables suggests possible overbooking
2. **Optimize Time Slots**: Stagger lunch bookings (12:00-14:00 has highest density)
3. **Add Large Tables**: Consider adding 2-3 more 8-person tables

### Long-term (Priority 3)

1. **Automated Service Period Management**: Allow bookings in transition periods
2. **Capacity Monitoring**: Alert when utilization exceeds 85%
3. **Table Combination Logic**: Improve algorithm for combining adjacent tables for large parties

---

## Technical Details

### Diagnostic Capture

For each failed booking, the system captured:

- ✅ Availability check result (all showed "available: true")
- ✅ Quote attempt details (hold status, candidates, alternates)
- ✅ List of skipped candidates with conflict reasons
- ✅ Restaurant capacity snapshot
- ✅ Existing allocations check

### Example: Detailed Failure for Party of 3 at 18:15

```json
{
  "bookingId": "15eb309e-e5b9-4d83-9374-e9edb3b86f3d",
  "partySize": 3,
  "time": "18:15",
  "availabilityCheck": {
    "available": true // High-level check passed
  },
  "quoteAttempt": {
    "gotHold": false,
    "reason": "No suitable tables available",
    "skippedCandidates": 14, // All 14 suitable tables were blocked
    "alternateOptions": [
      {
        "tableIds": ["a80a8ffd-5af2-4112-b70f-1de735a05c4c"],
        "totalCapacity": 4,
        "score": 6.5704
      }
      // ... 12 more alternatives, all with conflicts
    ]
  }
}
```

**Interpretation**: The availability check says "available" (enough overall capacity), but the quote system found that all 14 specific tables suitable for party size 3 had conflicting holds from other bookings.

---

## Conclusion

The auto-assignment script successfully **diagnosed** all failures with comprehensive detail. No new assignments were made because:

1. **67% already confirmed**: These were likely assigned by a previous run or manual process
2. **33% failed with clear reasons**:
   - 35% (7/20) due to service period constraints
   - 65% (13/20) due to table conflicts/capacity exhaustion

**Next Steps**: Focus on the 7 service period bookings (quick fix via configuration) and manually assign the 13 conflict-affected bookings after reviewing existing holds.
