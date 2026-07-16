# Wave 2: workaround options and edge cases

## Converged findings

- The smallest fix that exactly matches current authoritative Create behavior is party-aware duration-only filtering: `start + duration <= close`.
- The complete fix for the user's stated gap also activates last seating: `start + max(buffer, duration) <= close`.
- Buffer-only filtering is unsafe whenever duration exceeds buffer.
- Automatic duration shortening and implicit fixed-slot overrides are unsafe under current capacity and persistence semantics.
- Service-period end should remain an exclusive start boundary; operating close is the dining-finish boundary.
- Overnight/DST behavior is a separate P0 temporal-contract issue. Initial adoption must either normalize absolute instants end-to-end or fail closed for after-midnight/nonexistent/ambiguous slots.
- Public and ops should share eligibility reasons. Duration overrun remains non-overridable; a buffer-only violation may be ops-overridable only after an explicit product decision.

## Executed verification

- Formula matrix verified buffer-only, duration-only, composed, and shortening behavior.
- Edge-case property proof checked 14,974,960 combinations and confirmed:

  `start + D <= close AND start + B <= close`

  is equivalent to:

  `start <= close - max(D, B)`.

- Focused repository tests passed in research lanes for schedule, create validation, capacity windows, ops creation, and DST protection.

## EXPAND

- PRODUCT DECISION: If `buffer > duration`, may authorized ops override only the last-seating cutoff?
- PRODUCT DECISION: Suppress after-midnight public slots initially, or include full absolute-instant support in the same delivery?
- DEAD END: Buffer-only cannot compose safely with current independent turn-band durations.
- DEAD END: Current fixed-slot provenance cannot encode an exceptional close override.
- DEAD END: Automatic shortening cannot be adopted surgically because downstream capacity recomputes duration.
