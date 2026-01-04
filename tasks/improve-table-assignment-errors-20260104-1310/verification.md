---
task: improve-table-assignment-errors
timestamp_utc: 2026-01-04T13:10:00Z
owner: github:@assistant
risk: low
---

# Verification Report

## Summary

Enhanced error handling for table assignment validation failures to display clear, actionable messages with specific details about which tables caused the validation failure.

## Changes Made

### File: `src/components/features/dashboard/booking-details/BookingAssignmentTabContent.tsx`

**Lines 140-203**: Refactored `directAssignMutation.onError` handler

#### Before

- Duplicate error handling logic for 422 status codes
- Error messages built only from `details.checks` array
- Missing main error message with specific table names
- Toast duration: 8s

#### After

- Consolidated error handling for 422 status codes
- Main error message displayed first (contains specific table names)
- Validation checks appended as bullet points when available
- Toast duration: 10s (increased for readability)
- Clearer error message structure:

  ```
  Merged assignments require movable tables. Fixed tables: BAR-4F02, BAR-4F01

  • Additional validation check message 1
  • Additional validation check message 2
  ```

## Build Verification

- [x] TypeScript compilation successful
- [x] Next.js build completed without errors
- [x] No new linting issues introduced

## Manual QA Required

### Test Case 1: Fixed Table Assignment Error

**Steps:**

1. Navigate to a booking that requires merged table assignment
2. Select one or more fixed (non-movable) tables
3. Click "Assign" button

**Expected Result:**

- Error banner displays: "Merged assignments require movable tables. Fixed tables: [TABLE_NAMES]"
- Toast notification appears with same message
- Toast stays visible for 10 seconds
- Error is dismissible

### Test Case 2: Other Validation Errors

**Steps:**

1. Trigger other validation errors (capacity mismatch, adjacency issues, etc.)

**Expected Result:**

- Main error message displayed
- Validation checks listed as bullet points
- Error banner and toast both show full details

### Test Case 3: Missing Tables Error (Regression)

**Steps:**

1. Select tables
2. Have another user delete those tables
3. Try to assign

**Expected Result:**

- Error: "Selected tables were removed: [TABLE_IDS]"
- Selected tables are cleared from UI
- Assignment context is refetched

### Test Case 4: Successful Assignment (Regression)

**Steps:**

1. Select valid, available tables
2. Click "Assign"

**Expected Result:**

- No errors
- Success toast: "Tables assigned"
- Assignment completes successfully

## Accessibility

- [x] Error banner uses `Alert` component with proper ARIA roles
- [x] Toast notifications are screen-reader friendly (react-hot-toast)
- [x] Error messages are descriptive and actionable
- [x] Sufficient time to read (10s duration)

## Known Issues

None

## Sign-off

- [x] Code review: Self-reviewed
- [ ] Manual QA: Pending user testing
- [ ] Design/PM: N/A (error handling improvement)

## Next Steps

1. User to test the improved error messages with actual validation failures
2. Monitor for any edge cases or additional error codes that need handling
3. Consider future enhancement: Disable fixed tables in UI when merging is required
