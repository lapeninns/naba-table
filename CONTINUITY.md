# Continuity Ledger

Last updated: 2026-04-02T14:36:00Z

## Goal (incl. success criteria)

- Fix the reported one-hour booking time shift seen on a guest mobile surface after an admin changes a booking time.
- Success: booking-related guest and ops surfaces show the intended venue-local time after admin edits.
- Success: timezone parsing is stable for explicit-offset ISO strings, venue-local `YYYY-MM-DDTHH:mm` strings, and date-only calendar selections.

## Constraints/Assumptions

- Follow existing AGENTS SDLC flow with task artifacts.
- UI verification via Chrome DevTools MCP is required if the guest list UI changes.
- Keep the fix on canonical booking/ops codepaths rather than layering one-off patches.
- Assumption: the original report came from `/guest/bookings`, but the same class of bug can exist across booking-oriented guest/ops surfaces.

## Key decisions

- Treat this as a regression fix and verify the actual rendering path before patching.
- Replace one-off guest/UI fixes with a shared booking datetime normalizer.
- Normalize guest booking timestamps at the API boundary and the reservation adapter fallback path.
- Use venue-timezone-aware Luxon parsing so device timezone differences do not affect display, ordering, or synthesized ISO values.
- Standardize date-only and time-only helpers so calendar selection, date shifting, readable labels, floor-plan timestamps, and table-assignment windows do not drift by device timezone.

## State

- Phase 4 complete: repo-wide booking/ops normalization sweep, regression tests, lint, typecheck, and Chrome DevTools mobile verification are all complete in the workspace.

## Done

- Created task folder `tasks/fix-mobile-booking-time-shift-20260402-1240/` with current-state artifacts.
- Reviewed the root and closest AGENTS files plus the repo-local Nabatable task/fullstack skills.
- Traced the admin edit flow through the timezone-aware picker and booking update route.
- Identified a concrete guest list rendering bug: `BookingListClient` was relying on device-sensitive parsing/string slicing instead of venue-timezone-safe formatting.
- Added `reserve/shared/formatting/bookingDateTime.ts` as the shared timezone-safe normalizer.
- Normalized `/api/bookings` guest list responses to emit absolute ISO timestamps consistently.
- Updated reservation adapter fallback ISO synthesis to use the restaurant timezone.
- Updated guest bookings list, guest dashboard, guest receipt, and guest reservation detail rendering/derivation paths to use the shared normalizer.
- Standardized shared date-only/time-only helpers in `lib/utils/datetime.ts`.
- Updated ops dashboard date shifting, calendar range math, and DTO fallback ISO synthesis to avoid local-midnight/device-timezone drift.
- Updated `BookingValidationService` fallback ISO synthesis to use the restaurant timezone when `start_at` is missing.
- Updated assignment-context API computation to use and return the restaurant timezone.
- Updated table-assignment timeline parsing to interpret service window ISO values in the restaurant timezone.
- Updated ops floor-plan date selection, current timestamp derivation, and visible time labels to use the restaurant timezone.
- Added focused regression tests for explicit-offset and venue-local timestamp inputs, adapter fallback behavior, and guest dashboard derivations.
- Added focused regression tests for shared datetime utilities, ops dashboard date math, ops dashboard DTO fallback normalization, and floor-plan timeline rendering.
- Added a dev-only guest bookings harness because the real `/guest/bookings` route is auth-gated in local dev.
- Verified on a mobile viewport that both UTC-backed and venue-local booking inputs render as `19:30`.
- Verified on a mobile viewport that the ops floor-plan harness shows `Thursday 2 April 2026` and `19:30` consistently after the normalization sweep.
- Captured proof artifacts: Vitest log, mobile screenshot, and Lighthouse report.
- Captured additional post-sweep screenshots for guest bookings and ops floor plan.

## Now

- Preparing the final repo-consistency summary for the user.

## Next

- Summarize the broader normalization sweep, remaining scope boundary, and verification evidence.
- Optional follow-up: audit unrelated non-booking timestamp utilities if the user wants a full repo timestamp-style cleanup beyond booking/ops flows.

## Open questions (UNCONFIRMED if needed)

- Was the original report observed on `/guest/bookings`, `/guest/dashboard`, or an email/receipt surface? (UNCONFIRMED)
- Are there any still-unseen booking-adjacent surfaces outside the verified guest/ops paths that should be folded into the same helper set? (UNCONFIRMED)

## Working set (files/ids/commands)

- `tasks/fix-mobile-booking-time-shift-20260402-1240/research.md`
- `tasks/fix-mobile-booking-time-shift-20260402-1240/plan.md`
- `tasks/fix-mobile-booking-time-shift-20260402-1240/todo.md`
- `tasks/fix-mobile-booking-time-shift-20260402-1240/verification.md`
- `tasks/fix-mobile-booking-time-shift-20260402-1240/artifacts/`
- `CONTINUITY.md`
- `src/components/features/booking/list/BookingListClient.tsx`
- `src/components/features/guest/dashboard/GuestDashboardClient.tsx`
- `src/components/features/guest/dashboard/booking-derivations.ts`
- `src/app/guest/bookings/[bookingId]/receipt/ReceiptClient.tsx`
- `src/components/features/booking/detail/ReservationDetailClient.tsx`
- `src/app/api/bookings/route.ts`
- `src/app/api/ops/bookings/[id]/assignment-context/route.ts`
- `reserve/entities/reservation/adapter.ts`
- `reserve/shared/formatting/bookingDateTime.ts`
- `lib/utils/datetime.ts`
- `src/utils/ops/dashboard.ts`
- `src/utils/ops/mapOpsDashboardBookingItemToBookingDTO.ts`
- `server/booking/BookingValidationService.ts`
- `src/components/features/bookings/components/OpsBookingsDatePicker.tsx`
- `src/components/features/dashboard/HeatmapCalendar.tsx`
- `src/components/features/dashboard/useOpsDashboardUiActions.ts`
- `src/components/features/dashboard/booking-details/components/TableAssignmentPanel.tsx`
- `src/components/features/seating/FloorPlanPage.tsx`
- `src/components/features/seating/floor-plan/lib/date.ts`
- `src/components/features/seating/floor-plan/hooks/useFloorPlanTimelineConfig.ts`
- `src/components/features/seating/floor-plan/hooks/useFloorPlanTables.ts`
- `tests/components/BookingListClient.test.tsx`
- `tests/components/OpsDashboardStateUtils.test.ts`
- `tests/guest/bookingDateTime.test.ts`
- `tests/guest/reservationAdapter.test.ts`
- `tests/guest/booking-derivations.test.ts`
- `tests/utils/datetime.test.ts`
- `tests/utils/mapOpsDashboardBookingItemToBookingDTO.test.ts`
- `src/app/api/bookings/[id]/route.ts`
- `server/bookings/timezoneConversion.ts`
- `src/app/(public)/dev/guest-bookings/page.tsx`
- `src/app/(public)/dev/guest-bookings/ui/GuestBookingsDevHarness.tsx`
