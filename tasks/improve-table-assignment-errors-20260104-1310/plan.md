---
task: improve-table-assignment-errors
timestamp_utc: 2026-01-04T13:10:00Z
owner: github:@assistant
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Improve Table Assignment Error Handling

## Objective

We will enhance the table assignment error handling to display clear, actionable error messages so that users understand exactly what validation failed and how to fix it.

## Success Criteria

- [x] Main error message (with specific table names) is displayed prominently
- [x] Validation check details are appended when available
- [x] Error banner shows the full error message
- [x] Toast duration is sufficient for users to read detailed errors (10s)
- [x] No duplicate or redundant error handling logic

## Architecture & Components

### Modified Components

- **BookingAssignmentTabContent**: Error handling in `directAssignMutation.onError` (lines 140-203)

### Error Flow

1. API returns `HttpError` with status 422 and validation details
2. `onError` handler receives the error
3. Error is parsed and formatted:
   - Extract main `error.message` (contains specific table names)
   - Extract `details.checks` array (validation check details)
   - Combine into comprehensive error message
4. Display error:
   - Set `errorBanner` state (shows in `Alert` component)
   - Show toast notification with full details
   - Update `validationResult` state if checks are present

## Data Flow & API Contracts

### Input: API Error Response

```typescript
interface HttpError {
  status: 422;
  message: string; // e.g., "Merged assignments require movable tables. Fixed tables: BAR-4F02, BAR-4F01"
  code: string; // e.g., "MOVABLE"
  details: {
    checks?: Array<{
      id: string;
      passed: boolean;
      message: string;
    }>;
  };
}
```

### Output: User-Facing Error

```
Main error message

• Check 1 message
• Check 2 message
```

## UI/UX States

- **Error Banner**: Red `Alert` component at top of assignment panel (lines 381-387)
- **Toast**: Destructive variant with 10s duration
- **Validation Result**: Optional visual feedback for failed checks

## Edge Cases

1. **422 error without checks**: Show only main error message
2. **422 error with checks**: Show main message + bullet-pointed checks
3. **Non-422 HTTP errors**: Show generic error handling (unchanged)
4. **Non-HTTP errors**: Show generic "Assignment failed" (unchanged)

## Testing Strategy

### Manual Testing

1. Attempt to assign fixed tables to a booking that requires merged assignment
2. Verify error message shows:
   - Main message: "Merged assignments require movable tables. Fixed tables: [TABLE_NAMES]"
   - Toast appears with 10s duration
   - Error banner displays full message
3. Test other error scenarios (missing tables, generic errors)

### Regression Testing

- Ensure existing error handling for `TABLES_NOT_FOUND` still works
- Verify other HTTP errors still display correctly
- Check that successful assignments still work

## Rollout

- **No feature flag needed**: This is a pure error handling improvement
- **Exposure**: Immediate (100%)
- **Monitoring**: Watch for error logs in browser console; monitor user reports
- **Kill-switch**: Revert commit if error display breaks

## DB Change Plan

N/A - No database changes
