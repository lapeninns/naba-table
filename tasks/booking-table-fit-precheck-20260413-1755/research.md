---
task: booking-table-fit-precheck
timestamp_utc: 2026-04-13T17:55:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: [bookingValidationUnified]
related_tickets: []
---

# Research: booking table-fit precheck

## Requirements

- Functional:
  - Prevent the guest booking pre-check from returning a false positive when aggregate covers are available but no real table plan exists for the requested party.
  - Reuse the existing table-planner rules for mergeability, adjacency, and party-size fit instead of inventing a second capacity model.
  - Keep alternative slot suggestions trustworthy by filtering out slots that also fail the stronger seatability check.
  - Add a small guest-facing advisory on the plan step for weekend and holiday/override dates, with softer copy that tells guests to contact the venue to confirm.
- Non-functional:
  - Keep the canonical booking route and unified validation path aligned through the shared capacity service.
  - Avoid breaking venues that rely on aggregate capacity only; if no active table inventory exists, keep the aggregate behavior as the fallback.
  - Keep the advisory non-blocking and visually informational rather than destructive.

## Existing Patterns & Reuse

- `server/capacity/service.ts` already owns the shared availability pre-check and alternative-slot search used by the guest route and validation service.
- `server/capacity/table-assignment/availability.ts` and `server/capacity/selector.ts` already implement the real table-fit logic: active table filtering, merge rules, adjacency, and candidate-plan generation.
- `server/capacity/table-assignment/supabase.ts` exposes the request-independent data loaders needed to run the planner without creating a temporary booking row.
- `reserve/features/reservations/wizard/hooks/usePlanStepForm.ts` already tracks selected dates and calendar-mask data, making it the right place to compute a contextual advisory.

## Constraints & Risks

- Some restaurants may have capacity rules but no active table inventory. The stronger planner must not block those venues by assuming tables always exist.
- The public restaurant booking route is not reachable in the local dataset used for browser QA, so UI proof needs a dev-only harness instead of the real public slug.
- Weekend/holiday detection is only partially modeled client-side today. `restaurant_operating_hours.effective_date` rows are the closest proxy for holiday/special-date overrides, so the guest advisory uses override dates as its holiday signal.

## Open Questions (owner, due)

- Q: Should the stronger pre-check create a temporary booking row and reuse `quoteTablesForBooking`, or stay request-based?
  A: Stay request-based and reuse the lower-level planner primitives directly. That avoids writing draft bookings just to answer availability.

## Recommended Direction (with rationale)

- Add a shared request-based seatability helper that computes the booking window from the venue policy, loads active tables plus overlap context, and asks the existing planner whether any valid table plan exists.
- Invoke that helper only after the aggregate covers/parties check passes. This preserves the fast aggregate rejection path while eliminating the false-green-light case.
- Reuse the same helper when searching alternatives so suggested replacement times are actually seatable.
- Add an informational plan-step advisory driven by weekend dates and operating-hours override dates, with copy that nudges guests to contact the venue for confirmation.
