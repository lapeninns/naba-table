# Wave 1: slot generation

## Key findings

- `getRestaurantSchedule` returns configured candidate starts and ignores party size, turn-band duration, and last-seating buffer when building slots.
- `useTimeSlots` queries only by restaurant slug and date, so party size cannot currently affect the visible list.
- Initial guest times are configuration availability, not a capacity guarantee.
- Current generation supports overnight ranges, while downstream create validation does not compose with them.

## Primary anchors

- `server/restaurants/schedule.ts:187-205`
- `server/restaurants/schedule.ts:420-465`
- `server/restaurants/schedule.ts:511-512`
- `reserve/features/reservations/wizard/services/useTimeSlots.ts:18-52`

## EXPAND

- LEAD: Choose whether filtering belongs in the generic schedule or a guest-specific projection — WHY: internal consumers may still need unfiltered configured starts — ANGLE: architecture seam.
- LEAD: Decide overnight policy before sharing one boundary evaluator — WHY: current generator and create validator disagree — ANGLE: same-day versus next-day close representation.
- DEAD END: No current party-size-aware initial guest schedule query.
