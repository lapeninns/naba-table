# 🧪 Manual Testing Guide - Auto-Assignment with Party Size Changes

## Prerequisites

1. ✅ Dev server running: `pnpm run dev`
2. ✅ FEATURE_ALLOCATOR_K_MAX=5 in .env.local (DONE)
3. ✅ Browser open to: http://localhost:3000

---

## Test Flow

### 🎯 Objective

Verify that auto-assignment works correctly when modifying bookings with different party sizes, especially testing the kMax=5 fix for party of 12.

### 📋 Test Scenarios

---

## Scenario 1: Create Booking with Party of 12

**Steps:**

1. Navigate to: `http://localhost:3000/ops/bookings` (or reservations page)
2. Click "New Booking" or "Create Reservation"
3. Fill in the form:
   - **Party Size**: `12`
   - **Date**: Tomorrow or any available date
   - **Time**: `19:00` (7:00 PM)
   - **Guest Name**: `Test Party 12`
   - **Guest Email**: `test12@example.com`
   - **Guest Phone**: `+1234567890`
   - **Booking Type**: `Dinner`
   - **Seating**: `Any`
4. Click **Submit** / **Create Booking**

**Expected Result:**

- ✅ Booking created successfully
- ✅ Status changes to `confirmed` (within 3-5 seconds)
- ✅ You see table assignments (likely 3-4 tables, e.g., 2× 4-top + 2× 2-top)
- ✅ Guest receives confirmation email

**Actual Result:**

- [ ] Pass / [ ] Fail
- Tables assigned: ************\_\_\_************
- Total capacity: \_\_\_

---

## Scenario 2: Edit Booking from 12 → 9

**Steps:**

1. Find the booking created in Scenario 1
2. Click "Edit" or open booking detail page
3. Change **Party Size** from `12` to `9`
4. Click **Save**

**Expected Result:**

- ✅ Booking updated
- ✅ Status becomes `pending` then quickly `confirmed`
- ✅ Table assignment updates (likely 2-3 tables)
- ✅ Guest receives "modification confirmed" email

**Actual Result:**

- [ ] Pass / [ ] Fail
- Tables assigned: ************\_\_\_************
- Total capacity: \_\_\_

---

## Scenario 3: Edit Booking from 9 → 5

**Steps:**

1. Click "Edit" again on the same booking
2. Change **Party Size** from `9` to `5`
3. Click **Save**

**Expected Result:**

- ✅ Booking updated
- ✅ Status becomes `pending` then quickly `confirmed`
- ✅ Table assignment updates (likely 1-2 tables)

**Actual Result:**

- [ ] Pass / [ ] Fail
- Tables assigned: ************\_\_\_************
- Total capacity: \_\_\_

---

## Scenario 4: Edit Booking from 5 → 12 (Back to Original)

**Steps:**

1. Click "Edit" again on the same booking
2. Change **Party Size** from `5` to `12`
3. Click **Save**

**Expected Result:**

- ✅ Booking updated
- ✅ Status becomes `pending` then quickly `confirmed` **← THIS IS THE KEY TEST!**
- ✅ Table assignment updates (3-5 tables to accommodate 12 people)
- ✅ With kMax=5, system can now find combinations like:
  - 3× 4-top = 12
  - 2× 4-top + 2× 2-top = 12
  - 1× 4-top + 4× 2-top = 12

**Actual Result:**

- [ ] Pass / [ ] Fail
- Tables assigned: ************\_\_\_************
- Total capacity: \_\_\_
- **If FAILED**: Status remains `pending`, reason: ************\_\_\_************

---

## Alternative Test (If UI Not Working)

### Using Browser DevTools Console

1. Open browser console (F12)
2. Run this script:

```javascript
// Test auto-assignment for existing booking
const bookingId = '97fad88e-5c58-46a8-a2db-2882b9a567be'; // Or use your new booking ID

// Test 1: Modify to party 12
fetch(`/api/bookings/${bookingId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    date: '2025-12-11',
    time: '12:45',
    party: 12,
    bookingType: 'lunch',
    seating: 'any',
    name: 'Test Party 12',
    email: 'test12@example.com',
    phone: '+1234567890',
  }),
})
  .then((r) => r.json())
  .then((data) => console.log('Modify to 12:', data))
  .catch((err) => console.error('Error:', err));

// Wait 5 seconds, then check status
setTimeout(() => {
  fetch(`/api/bookings/${bookingId}`)
    .then((r) => r.json())
    .then((data) =>
      console.log('Current status:', data.status, 'Tables:', data.tableAssignments?.length),
    );
}, 5000);
```

---

## Monitoring Logs

Open a second terminal and watch the logs:

```bash
# In the terminal running `pnpm run dev`, watch for:
tail -f .next/trace | grep "auto-assign"
```

**Look for:**

```
✅ SUCCESS:
[auto-assign][job] scheduled { bookingId: '...', reason: 'modification', ... }
[auto-assign][job] attempt.success { attempt: 0, holdId: '...', durationMs: ... }

❌ FAILURE (OLD BEHAVIOR):
[auto-assign][job] attempt.no_hold { reason: "No tables meet the capacity requirements..." }
[auto-assign][job] exhausted { attempts: 1 }
```

---

## Success Criteria

✅ **All Tests Pass If:**

1. Party of 12 can be created and auto-assigned (3-5 tables)
2. Reducing party size (12→9→5) works and reassigns fewer tables
3. **CRITICAL**: Increasing back to 12 succeeds with auto-assignment
4. No "No tables meet capacity requirements" errors
5. All bookings show `status: confi rmed` after modification

❌ **Test Fails If:**

- Party of 12 remains `pending` after modification
- Error: "No tables meet the capacity requirements"
- Admin notification email sent (indicates auto-assignment failed)

---

## Verification Queries

Run these in your database tool to verify:

### Check booking status

```sql
SELECT id, party_size, status, created_at, updated_at
FROM bookings
WHERE id = '97fad88e-5c58-46a8-a2db-2882b9a567be';
```

### Check table assignments

```sql
SELECT bta.id, ti.table_number, ti.capacity
FROM booking_table_assignments bta
JOIN table_inventory ti ON bta.table_id = ti.id
WHERE bta.booking_id = '97fad88e-5c58-46a8-a2db-2882b9a567be'
ORDER BY ti.table_number;
```

### Check total assigned capacity

```sql
SELECT
  b.party_size,
  COUNT(bta.id) as tables_assigned,
  SUM(ti.capacity) as total_capacity
FROM bookings b
LEFT JOIN booking_table_assignments bta ON b.id = bta.booking_id
LEFT JOIN table_inventory ti ON bta.table_id = ti.id
WHERE b.id = '97fad88e-5c58-46a8-a2db-2882b9a567be'
GROUP BY b.id, b.party_size;
```

---

## Expected Timeline

- **Before fix** (kMax=3): Party of 12 fails → stays `pending`
- **After fix** (kMax=5): Party of 12 succeeds → becomes `confirmed` in 2-5 seconds

---

## Troubleshooting

### If Test Still Fails

1. **Verify env variable loaded**:

   ```bash
   grep FEATURE_ALLOCATOR_K_MAX .env.local
   # Should show: FEATURE_ALLOCATOR_K_MAX=5
   ```

2. **Restart dev server** (changes require restart):

   ```bash
   # Kill and restart
   pnpm run dev
   ```

3. **Check adjacency data**:

   ```bash
   pnpm tsx scripts/check-adjacency.ts
   # Should show: ALLOCATOR_K_MAX: 5
   ```

4. **Enable debug logging**:

   ```bash
   # Add to .env.local
   CAPACITY_DEBUG=1

   # Restart server, then check logs for detailed diagnostics
   ```

---

## Report Results

After testing, please report:

1. ✅/❌ for each scenario
2. Any error messages
3. Table assignments for party of 12
4. Server log excerpts (if failures occurred)

This will confirm the fix is working correctly! 🎉
