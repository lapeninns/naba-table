# Wave 1: settings contract

## Key findings

- The last-seating buffer is persisted, returned by schedule, normalized by the guest client, and then dropped from behavior.
- Turn bands are authoritative in booking creation and seatability, but absent from schedule generation and display.
- The safest seam is a server-owned party-aware schedule projection; returning raw bands would duplicate policy in clients.
- Alternative-slot aggregate evaluation accepts but drops the supplied duration.

## Primary anchors

- `components/ops/restaurants/details/BookingRulesSubform.tsx:164-215`
- `components/ops/restaurants/restaurantDetailsFormModel.ts:90-96,386-395`
- `server/restaurants/schedule.ts:492-512,590-605,622-640`
- `server/restaurants/turnBands.ts:36-177`
- `server/bookings/duration.ts:45-84`
- `server/capacity/service.ts:425-432`

## EXPAND

- Decide whether configured slots are absolute or cutoff-constrained.
- Audit production/staging column default and constraint because the original migration file was removed during baseline cleanup.
- Align turn-band maximum duration with the 360-minute online-validation limit.
- Decide how custom occasion keys should participate in the public schedule.
- Add contract tests for party-size query-key separation, midnight cutoff, buffer larger than service window, turn-band overflow fallback, and guest/server confirmation-duration parity.
- Add a regression test proving `findAlternativeSlots` forwards `durationMinutes`.
