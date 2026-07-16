# Wave 1: adversarial edge cases

## Key findings

- The non-additive two-constraint rule is correct under current UI semantics.
- Fixed slots are candidates, not safety overrides.
- Party changes must recompute eligibility and invalidate stale selections.
- Overnight, DST ambiguity, and UTC+14 date derivation are not safe under the current `date + HH:mm` contract.
- Additive response metadata allows a staged API rollout.

## Primary anchors

- `components/ops/restaurants/restaurantDetailsFormModel.ts:94-95`
- `server/bookings/duration.ts:45-84`
- `server/capacity/policy.ts:289-351`
- `server/restaurants/schedule.ts:106-205`
- `reserve/shared/schedule/availability.ts:133-165`
- `server/booking/BookingValidationService.ts:438-465`

## EXPAND

- LEAD RESOLVED: Historical reason for missing cutoff — deliberately removed in commit `ab301ac2`.
- LEAD RESOLVED: Buffer semantics — current UI defines a latest-seating lead, not cleanup time.
- LEAD RESOLVED: DST gap behavior — executable Luxon probe and existing guarded capacity implementation confirm silent coercion risk.
- LEAD RESOLVED: UTC+14 date semantics — executable probe confirms weekday/month drift.
- PRODUCT DECISION REQUIRED: Whether an after-midnight booking’s `booking_date` means actual local start date or originating service date.
- PRODUCT DECISION REQUIRED: Whether service-period end should ever constrain dining end; current behavior and `allowOverrun` indicate this must remain separate.
- PRODUCT DECISION REQUIRED: Legacy callers without party—temporary unchanged behavior versus immediate conservative filtering.
- none unchecked — remaining items are explicit product/migration decisions, not unsearched evidence leads.
