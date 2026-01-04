---
task: improve-table-assignment-errors
timestamp_utc: 2026-01-04T13:10:00Z
owner: github:@assistant
reviewers: []
risk: low
---

# Implementation Checklist

## Setup

- [x] Identify error handling location (`BookingAssignmentTabContent.tsx`, lines 140-203)
- [x] Understand API error structure from `/api/ops/bookings/[id]/assign-tables`

## Core

- [x] Consolidate duplicate error handling logic
- [x] Prioritize main error message over check messages
- [x] Build comprehensive error message (main + checks)
- [x] Update error banner state with full message
- [x] Update toast with full message and increased duration (10s)
- [x] Preserve validation result state update for UI feedback

## Error Handling Improvements

- [x] Handle `TABLES_NOT_FOUND` error (unchanged)
- [x] Handle 422 validation errors (improved)
- [x] Handle other HTTP errors (unchanged)
- [x] Handle generic errors (unchanged)

## Testing

- [ ] Manual test: Assign fixed tables to booking requiring merged assignment
- [ ] Verify error message shows specific table names
- [ ] Verify toast duration is 10s
- [ ] Verify error banner displays correctly
- [ ] Test regression: `TABLES_NOT_FOUND` error still works
- [ ] Test regression: Successful assignments still work

## Notes

### Assumptions

- API continues to return error messages with specific table names embedded
- `HttpError` class correctly parses error responses from API
- Error banner uses `whitespace-pre-line` to preserve newlines (confirmed on line 383)

### Deviations

- None

## Batched Questions

- None
