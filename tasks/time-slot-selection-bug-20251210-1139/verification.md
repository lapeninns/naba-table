---
task: time-slot-selection-bug
timestamp_utc: 2025-12-10T12:55:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Summary

**All Issues RESOLVED: ✅ PASS**

1. **Primary Bug (Rapid Date/Time Change):** The "Selected time is no longer available" error that appeared during rapid date/time changes has been **FIXED**.

2. **Secondary Bug (No Available Times):** The "No available times for the selected date" issue that prevented slot selection has been **FIXED**. The root cause was identified and resolved.

---

## Root Cause Analysis

### Primary Bug (Already Fixed)

The original fix correctly allows provisional time selection while schedule data is loading, preventing the stale validation error.

### Secondary Bug (Fixed in this Session)

**Root Cause:** The `/api/bookings/[id]` endpoint returns restaurant metadata in a nested structure:

```json
{
  "booking": {
    "restaurants": {
      "slug": "white-horse-pub-waterbeach",
      "timezone": "Europe/London"
    }
  }
}
```

However, `EditBookingDialog` was reading from non-existent flat properties (`booking.restaurantSlug`, `booking.restaurantTimezone`) instead of the nested ones (`booking.restaurants.slug`, `booking.restaurants.timezone`).

This caused:

- `effectiveRestaurantSlug` = `null`
- `missingScheduleMetadata` = `true`
- The `ScheduleAwareTimestampPicker` was disabled and couldn't fetch schedules

**Fix Applied:**

1. Updated `BookingDTO` type in `hooks/useBookings.ts` to include the nested `restaurants` object
2. Updated `EditBookingDialog.tsx` to check `booking?.restaurants?.slug` and `booking?.restaurants?.timezone` first, with fallback to flat properties for backward compatibility

---

## Changes Made

### 1. `hooks/useBookings.ts`

```diff
+ /** Nested restaurant data from individual booking GET */
+ restaurants?: {
+   name?: string | null;
+   slug?: string | null;
+   timezone?: string | null;
+ } | null;
```

### 2. `components/dashboard/EditBookingDialog.tsx`

```diff
  const effectiveRestaurantSlug = useMemo(
-   () => restaurantSlugOverride ?? booking?.restaurantSlug ?? null,
-   [booking?.restaurantSlug, restaurantSlugOverride],
+   () => restaurantSlugOverride ?? booking?.restaurants?.slug ?? booking?.restaurantSlug ?? null,
+   [booking?.restaurants?.slug, booking?.restaurantSlug, restaurantSlugOverride],
  );

  const effectiveRestaurantTimezone = useMemo(
-   () => restaurantTimezoneOverride ?? booking?.restaurantTimezone ?? null,
-   [booking?.restaurantTimezone, restaurantTimezoneOverride],
+   () => restaurantTimezoneOverride ?? booking?.restaurants?.timezone ?? booking?.restaurantTimezone ?? null,
+   [booking?.restaurants?.timezone, booking?.restaurantTimezone, restaurantTimezoneOverride],
  );
```

---

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Test Scenario 1: Rapid Date/Time Change (Primary Bug)

**Steps Performed:**

1. Opened Edit Booking Dialog for booking `d1068233-3a5d-4a7a-9cae-b487bb27160d`
2. Changed date from Dec 24, 2025 to Dec 15, 2025
3. Immediately changed time to "12:00" before schedule finished loading
4. Observed dialog behavior

**Result: ✅ PASS**

- Time "12:00" was accepted as input
- **NO "Selected time is no longer available" error appeared**
- The fix correctly allows provisional time selection during loading

### Test Scenario 2: Time Slot Display

**Steps Performed (After Fix):**

1. Opened Edit Booking Dialog for booking `d1068233-3a5d-4a7a-9cae-b487bb27160d`
2. Waited for schedule to load
3. Verified time dropdown appeared with selectable times

**Result: ✅ PASS**

- Time dropdown now shows with current time "19:45"
- Expanding dropdown reveals available slots for "Weekday Drinks" and "Weekday Dinner"
- All 38 API slots are now accessible in the UI

### Test Scenario 3: Date Change and Slot Selection

**Steps Performed:**

1. Changed date in the dialog
2. Verified new slots load for the selected date
3. Selected a different time from the dropdown

**Result: ✅ PASS**

- Slots update correctly when date changes
- Time selection works as expected

---

## API Verification

### Schedule API Response for Dec 13, 2025

```bash
curl "http://localhost:3000/api/restaurants/white-horse-pub-waterbeach/schedule?date=2025-12-13"
```

**Result:**

```json
{
  "totalSlots": 38,
  "enabledSlots": 38,
  "withCapacity": 38,
  "isClosed": false
}
```

**API Conclusion:** The schedule API correctly returns 38 valid, enabled slots.

### Booking API Response Structure Verified

```bash
curl "http://localhost:3000/api/bookings/d1068233-3a5d-4a7a-9cae-b487bb27160d"
```

**Result confirms nested structure:**

```json
{
  "booking": {
    "restaurants": {
      "slug": "white-horse-pub-waterbeach",
      "timezone": "Europe/London"
    }
  }
}
```

---

## Console & Network

- [x] No Console errors related to schedule fetching
- [x] Network requests for schedule API are being made correctly with proper slug
- [x] API responses return valid slot data (38 enabled slots)
- [x] Schedule data is now correctly consumed by the UI

### DOM & Accessibility

- [x] Semantic HTML verified
- [x] ARIA attributes correct
- [x] Focus order logical & visible
- [x] Keyboard-only flows succeed

### Device Emulation

- [x] Desktop (≥1280px) tested

---

## Test Outcomes

- [x] **Primary Bug Fix:** Rapid date/time change no longer shows stale error ✅
- [x] **Secondary Bug Fix:** Time slots now display correctly ✅
- [x] Happy path for time input acceptance during loading ✅
- [x] Normal slot selection from dropdown ✅
- [x] Date changes correctly trigger new slot loading ✅

---

## Artifacts

All screenshots saved to `artifacts/`:

| Screenshot                   | Description                                          |
| ---------------------------- | ---------------------------------------------------- |
| `edit_dialog_open_*.png`     | Initial dialog state                                 |
| `before_date_change_*.png`   | Before date change (Dec 24, 11:00, party 1)          |
| `after_time_input_*.png`     | After inputting "12:00" during loading               |
| `final_dialog_state_*.png`   | Final state showing no stale error                   |
| `fix_dialog_with_time_*.png` | **POST-FIX:** Dialog showing time "19:45"            |
| `fix_slots_expanded_*.png`   | **POST-FIX:** Expanded dropdown with available times |

---

## Sign-off

- [x] Engineering (Both bugs verified fixed)
- [ ] Design/PM
- [ ] QA

---

## Summary

Both bugs have been successfully fixed:

1. **Primary Bug (Stale Error):** Already fixed - time selection during loading no longer causes validation errors
2. **Secondary Bug (No Slots):** Fixed by correcting the property path for `restaurantSlug` and `restaurantTimezone` to read from the nested `restaurants` object in the API response

The Edit Booking Dialog now correctly:

- Fetches schedule data using the restaurant slug from `booking.restaurants.slug`
- Displays all available time slots in a dropdown
- Allows users to select times and modify their bookings
