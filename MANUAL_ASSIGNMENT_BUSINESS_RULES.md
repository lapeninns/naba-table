# Manual Assignment Business Rules

## Overview

The direct table assignment system enforces the same business rules as the automatic assignment algorithm to ensure consistent behavior and prevent invalid assignments.

## Validation Rules

### 1. **Zone Consistency** ✅

**Rule:** All selected tables must be in the same zone.

**Reason:** Tables from different zones cannot be merged for a single booking.

**Example:**

- ✅ **Valid:** Table 1 (Zone A) + Table 2 (Zone A)
- ❌ **Invalid:** Table 1 (Zone A) + Table 3 (Zone B)

**Error Message:**

```
Tables are in different zones: Zone A, Zone B
```

---

### 2. **Zone Lock** ✅

**Rule:** If a booking is locked to a specific zone, only tables from that zone can be assigned.

**Reason:** Some bookings are pre-assigned to specific zones (e.g., VIP area, outdoor seating).

**Example:**

- Booking locked to "Zone A"
- ✅ **Valid:** Select tables only from Zone A
- ❌ **Invalid:** Select tables from Zone B

**Error Message:**

```
Booking is locked to zone Zone A; selected tables are in zone Zone B
```

---

### 3. **Movable Requirement (Table Merging)** ✅

**Rule:** When selecting multiple tables (merging), ALL tables must be movable.

**Reason:** Fixed tables cannot be physically moved together. Only movable tables can be merged for larger parties.

**Table Mobility Types:**

- **movable** - Can be moved and merged with other tables
- **fixed** - Cannot be moved (e.g., booths, built-in seating)

**Example:**

- ✅ **Valid:** Table 1 (movable) + Table 2 (movable)
- ✅ **Valid:** Table 5 (fixed) - single table
- ❌ **Invalid:** Table 1 (movable) + Table 5 (fixed)

**Error Message:**

```
Merged assignments require movable tables. Fixed tables: Table 5
```

---

### 4. **Capacity Requirement** ✅

**Rule:** Total capacity of selected tables must meet or exceed party size.

**Reason:** Ensure enough seats for all guests.

**Example:**

- Party size: 6 guests
- ✅ **Valid:** Table 1 (4 seats) + Table 2 (2 seats) = 6 seats
- ✅ **Valid:** Table 3 (8 seats) = 8 seats (with slack)
- ❌ **Invalid:** Table 4 (2 seats) = only 2 seats

**Error Message:**

```
Selected tables (2 seats) don't meet party size (6)
```

---

### 5. **Adjacency Requirement** (Optional) ✅

**Rule:** When adjacency is required and multiple tables are selected, tables must be physically adjacent.

**Reason:** Ensures merged tables are next to each other for better guest experience.

**Adjacency Modes:**

- **connected** (default) - Tables must form a connected group
- **pairwise** - Every table must be adjacent to every other table
- **neighbors** - Tables must share a common neighbor/hub

**Example with `connected` mode:**

- ✅ **Valid:** Table 1 ↔ Table 2 ↔ Table 3 (chain)
- ✅ **Valid:** Table 1 ↔ Table 2 (pair)
- ❌ **Invalid:** Table 1, Table 5 (not connected)

**Error Messages:**

- `"Tables must remain connected when adjacency enforcement is enabled"`
- `"Tables must be adjacent to every other selected table"` (pairwise)
- `"Tables must share a common neighbor/hub to be merged"` (neighbors)

**Note:** Adjacency is typically only required for larger parties (configured via `FEATURE_ALLOCATOR_ADJACENCY_MIN_PARTY_SIZE`)

---

### 6. **Time Conflict Check** ✅

**Rule:** Selected tables must be available during the booking time window.

**Reason:** Prevent double-booking the same table.

**Checks:**

- No overlapping bookings on selected tables
- No active holds on selected tables (from other bookings)

**Error Message:**

```
2 table(s) have conflicting bookings at this time
```

---

## Validation Flow

When a user attempts to assign tables, the system validates in this order:

```
1. Zone Consistency
   ↓ (if all in same zone)
2. Zone Lock Check (if booking has assigned zone)
   ↓ (if zone matches or no lock)
3. Movable Requirement (if multiple tables)
   ↓ (if all movable or single table)
4. Capacity Check
   ↓ (if sufficient capacity)
5. Adjacency Check (if required)
   ↓ (if adjacent or not required)
6. Time Conflict Check
   ↓ (if no conflicts)
✅ ASSIGNMENT SUCCESS
```

**If ANY check fails, the assignment is rejected with a clear error message.**

---

## User Experience

### Error Display

When validation fails, users see:

**Toast Notification:**

```
Title: "Cannot assign tables"
Description:
• All tables must be in the same zone
• Merged assignments require movable tables. Fixed tables: Table 5
• Selected tables (2 seats) don't meet party size (4)
```

Multiple errors are shown together with bullet points for clarity.

### Success Display

When assignment succeeds:

**Toast Notification:**

```
Title: "Tables assigned"
Description: "Successfully assigned 2 table(s) to booking."
```

---

## Configuration

### Feature Flags

```typescript
// Adjacency requirement
FEATURE_ALLOCATOR_REQUIRE_ADJACENCY = true; // Enable adjacency checks
FEATURE_ALLOCATOR_ADJACENCY_MIN_PARTY_SIZE = 6; // Only for parties of 6+
FEATURE_ALLOCATOR_ADJACENCY_MODE = connected; // connected|pairwise|neighbors

// Manual assignment
FEATURE_MANUAL_ASSIGNMENT_MAX_SLACK = 4; // Allow up to 4 extra seats
```

### Slack Budget

**Slack** = Extra capacity beyond party size

Example:

- Party size: 4
- Selected capacity: 6
- Slack: 2 seats (within budget ✅)

**Max slack** prevents wasteful assignments (e.g., assigning 10-seat table for 2 people).

---

## Comparison: Manual vs Auto-Assign

| Rule             | Manual Assignment | Auto-Assign     |
| ---------------- | ----------------- | --------------- |
| Zone consistency | ✅ Required       | ✅ Required     |
| Zone lock        | ✅ Enforced       | ✅ Enforced     |
| Movable merging  | ✅ Required       | ✅ Required     |
| Capacity         | ✅ Validated      | ✅ Validated    |
| Adjacency        | ⚙️ Configurable   | ⚙️ Configurable |
| Time conflicts   | ✅ Prevented      | ✅ Prevented    |
| Slack budget     | ✅ Applied        | ✅ Applied      |

**Result:** Both systems follow the same rules, ensuring consistency.

---

## Examples

### Example 1: Valid Single Table Assignment

```
Booking: Party of 4
Selection: Table 1 (6 seats, Zone A, movable)

Validation:
✅ Zone: All tables in Zone A
✅ Movable: Single table (no merging)
✅ Capacity: 6 seats ≥ 4 guests
✅ Conflicts: No overlapping bookings

Result: ✅ ASSIGNED
```

### Example 2: Valid Merged Tables

```
Booking: Party of 8
Selection:
  - Table 1 (4 seats, Zone A, movable)
  - Table 2 (4 seats, Zone A, movable)

Validation:
✅ Zone: All tables in Zone A
✅ Movable: Both tables are movable
✅ Capacity: 8 seats = 8 guests
✅ Adjacency: Tables are connected (if required)
✅ Conflicts: No overlapping bookings

Result: ✅ ASSIGNED
```

### Example 3: Invalid - Mixed Zones

```
Booking: Party of 6
Selection:
  - Table 1 (4 seats, Zone A, movable)
  - Table 3 (4 seats, Zone B, movable)

Validation:
❌ Zone: Tables are in different zones: Zone A, Zone B

Result: ❌ REJECTED
Error: "Tables are in different zones: Zone A, Zone B"
```

### Example 4: Invalid - Fixed Table in Merge

```
Booking: Party of 6
Selection:
  - Table 1 (4 seats, Zone A, movable)
  - Table 5 (4 seats, Zone A, fixed)

Validation:
✅ Zone: All tables in Zone A
❌ Movable: Cannot merge fixed tables

Result: ❌ REJECTED
Error: "Merged assignments require movable tables. Fixed tables: Table 5"
```

### Example 5: Invalid - Insufficient Capacity

```
Booking: Party of 6
Selection: Table 4 (2 seats, Zone A, movable)

Validation:
✅ Zone: All tables in Zone A
✅ Movable: Single table (no merging)
❌ Capacity: 2 seats < 6 guests

Result: ❌ REJECTED
Error: "Selected tables (2 seats) don't meet party size (6)"
```

### Example 6: Invalid - Time Conflict

```
Booking: Party of 4 at 7:00 PM
Selection: Table 1 (4 seats, Zone A, movable)

Validation:
✅ Zone: All tables in Zone A
✅ Movable: Single table
✅ Capacity: 4 seats = 4 guests
❌ Conflicts: Table 1 already assigned to another booking at 7:00 PM

Result: ❌ REJECTED
Error: "1 table(s) have conflicting bookings at this time"
```

---

## Testing Checklist

To verify the business rules are working correctly:

- [ ] Try assigning tables from different zones → Should fail
- [ ] Try merging movable + fixed tables → Should fail
- [ ] Try assigning insufficient capacity → Should fail
- [ ] Try assigning tables with time conflicts → Should fail
- [ ] Try assigning single fixed table → Should succeed
- [ ] Try merging multiple movable tables (same zone, sufficient capacity) → Should succeed
- [ ] Try assigning to zone-locked booking with wrong zone → Should fail
- [ ] Try valid assignment → Should succeed with success toast

---

## Summary

The direct assignment system enforces all business rules from the auto-assign algorithm:

1. ✅ **Zone consistency** - Same zone required
2. ✅ **Zone locking** - Respect pre-assigned zones
3. ✅ **Movable merging** - Only movable tables can be merged
4. ✅ **Capacity** - Must meet party size
5. ✅ **Adjacency** - Tables must be adjacent (when required)
6. ✅ **Time conflicts** - Prevent double-booking

This ensures consistent behavior between manual and automatic assignment, maintaining data integrity and business logic across the entire system.
