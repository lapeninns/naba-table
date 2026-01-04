# Continuity Ledger

Last updated: 2026-01-04T13:35:00Z

## Goal (incl. success criteria)

- Fix ESLint warnings blocking pre-commit (hooks deps and queryKey memoization)
- Keep prior table assignment error handling intact

## Constraints/Assumptions

- Must resolve warnings in:
  - `src/components/features/dashboard/booking-details/BookingAssignmentTabContent.tsx`
  - `src/hooks/ops/useOpsBooking.ts`
  - `src/hooks/ops/useOpsBookingChanges.ts`
  - `src/hooks/ops/useOpsBookingHeatmap.ts`
  - `src/hooks/ops/useOpsTodaySummary.ts`
- Avoid unrelated refactors; only adjust deps/memoization

## Key decisions

- Enhanced error parsing to extract specific error codes and table information
- Show main error message first (contains specific table names)
- Append validation check details as bullet points when available
- Increased toast duration from 8s to 10s for better readability
- Consolidated duplicate error handling logic

## State

ESLint warnings reported; no code changes made yet.

## Done

- Captured pre-commit ESLint warnings list from user output

## Now

- Identify code causing hook deps/queryKey warnings

## Next

- Update hook deps or memoize queryKey
- Rerun/advise lint check

## Open questions (UNCONFIRMED if needed)

- Are there other error codes besides `MOVABLE` that need special handling?
  (Will monitor after deployment)

## Working set (files/ids/commands)

- `src/components/features/dashboard/booking-details/BookingAssignmentTabContent.tsx` (lines 371, 421)
- `src/hooks/ops/useOpsBooking.ts` (queryKey/useEffect deps)
- `src/hooks/ops/useOpsBookingChanges.ts` (queryKey/useEffect deps)
- `src/hooks/ops/useOpsBookingHeatmap.ts` (queryKey/useEffect deps)
- `src/hooks/ops/useOpsTodaySummary.ts` (queryKey/useEffect deps)
