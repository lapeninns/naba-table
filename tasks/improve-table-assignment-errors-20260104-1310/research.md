---
task: improve-table-assignment-errors
timestamp_utc: 2026-01-04T13:10:00Z
owner: github:@assistant
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Research: Improve Table Assignment Error Handling

## Requirements

### Functional

- Display clear, actionable error messages when table assignment validation fails
- Show specific table names that caused the validation failure
- Parse and present error codes (e.g., `MOVABLE`) in user-friendly format
- Help users understand what constraint was violated and how to fix it

### Non-functional

- Error messages should be accessible (screen reader friendly)
- Errors should be visible for sufficient time (10s duration for important errors)
- Error banner should be prominent but not block the UI

## Existing Patterns & Reuse

### Current Implementation

- File: `src/components/features/dashboard/booking-details/BookingAssignmentTabContent.tsx`
- Lines 140-203: `onError` handler for `directAssignMutation`
- Uses `HttpError` class from `@/lib/http/errors`
- Error display: Toast notifications + error banner (`Alert` component)

### API Error Structure

- Endpoint: `POST /api/ops/bookings/[id]/assign-tables`
- Returns 422 for validation failures
- Error format:
  ```json
  {
    "error": "Merged assignments require movable tables. Fixed tables: BAR-4F02, BAR-4F01",
    "code": "MOVABLE",
    "details": {
      "checks": [
        { "id": "movable", "passed": false, "message": "..." }
      ],
      "conflicts": []
    },
    "bookingId": "...",
    "tableIds": [...]
  }
  ```

### Identified Issues

1. **Duplicate error handling**: Lines 157-171 and 172-182 both handle validation errors with overlapping logic
2. **Missing main error message**: The code builds error messages from `details.checks` but ignores the main `error` field which contains specific table names
3. **Inconsistent flow**: The first block (157-171) sets `validationResult` but doesn't set error banner or return
4. **Poor error message**: Current implementation shows only check messages, missing context from the main error

## External Resources

- WAI-ARIA: [Alert and Live Regions](https://www.w3.org/WAI/ARIA/apg/patterns/alert/) - for accessible error messaging
- Material Design: [Error States](https://m2.material.io/design/communication/confirmation-acknowledgement.html#error-states) - UX patterns

## Constraints & Risks

### Constraints

- Must maintain existing error handling for other error types (`TABLES_NOT_FOUND`, etc.)
- Must not break optimistic UI updates
- Error messages must be accessible (ARIA live regions already in place via toast)

### Risks

- **Low risk**: Only modifying error handling logic, not core functionality
- Error parsing depends on API contract stability

## Open Questions

- Q: Are there other error codes besides `MOVABLE` that need special handling?
  A: **UNCONFIRMED** - Will monitor after deployment

- Q: Should we disable fixed tables in the UI when merging is required?
  A: **OUT OF SCOPE** - Current task is error handling only; UX prevention is a future enhancement

## Recommended Direction (with rationale)

### Approach

1. **Consolidate error handling for 422 status**: Merge the two overlapping blocks (lines 157-182)
2. **Prioritize main error message**: Show `error.message` first, then append validation check details if present
3. **Improve formatting**: Use newlines to separate main message from check details
4. **Increase toast duration**: Change from 8s to 10s for validation errors (more text to read)

### Rationale

- **User-centric**: The main error message (e.g., "Merged assignments require movable tables. Fixed tables: BAR-4F02, BAR-4F01") contains the most actionable information
- **Accessibility**: Longer toast duration gives users time to read detailed error messages
- **Maintainability**: Consolidating the error handling logic reduces code duplication and potential bugs
- **Extensibility**: This approach will work for any future validation error codes without modification
