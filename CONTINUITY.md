# Continuity Ledger

Last updated: 2026-01-04T13:15:00Z

## Goal (incl. success criteria)

- ✅ Improve table assignment error handling to show clear, actionable messages when validation fails
- ✅ Specifically handle `MOVABLE` error code (fixed tables cannot be merged)
- ✅ Display which specific tables caused the validation failure
- ✅ Help users understand what they need to do differently

## Constraints/Assumptions

- API returns structured errors with `code`, `error`, and `details` fields
- Error code `MOVABLE` indicates user tried to assign fixed (non-movable) tables when merging is required
- Error handling consolidated in `BookingAssignmentTabContent.tsx` (lines 140-203)
- Error messages must be accessible (ARIA live regions via toast)

## Key decisions

- Enhanced error parsing to extract specific error codes and table information
- Show main error message first (contains specific table names)
- Append validation check details as bullet points when available
- Increased toast duration from 8s to 10s for better readability
- Consolidated duplicate error handling logic

## State

Task completed; ready for user testing.

## Done

- Fixed auth redirect 404 (`/auth` → `/auth/signin`)
- Removed flashing offline indicator
- Analyzed API error response structure
- Located table assignment UI and error handling code
- Improved error handling in `BookingAssignmentTabContent.tsx`:
  - Consolidated duplicate 422 error handling
  - Prioritized main error message with specific table names
  - Added validation check details as bullet points
  - Increased toast duration to 10s
- Created task documentation in `tasks/improve-table-assignment-errors-20260104-1310/`
- Verified build succeeds with no errors

## Now

- Awaiting user verification and testing

## Next

- User to test improved error messages
- Monitor for additional error codes that may need special handling
- Consider future UX improvement: disable fixed tables when merging is required

## Open questions (UNCONFIRMED if needed)

- Are there other error codes besides `MOVABLE` that need special handling?
  (Will monitor after deployment)

## Working set (files/ids/commands)

- `src/components/features/dashboard/booking-details/BookingAssignmentTabContent.tsx` (lines 140-203)
- `tasks/improve-table-assignment-errors-20260104-1310/`
