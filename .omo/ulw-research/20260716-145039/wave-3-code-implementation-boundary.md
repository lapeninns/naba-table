# Wave 3: implementation-boundary critique

## Verdict

Pass with corrections.

## Corrected seam

- A leaf pure decision module should evaluate all online timing invariants, including buffer and duration under the user’s requested policy.
- A guest schedule projection should compose the generic candidate schedule with one preloaded turn-band query.
- `BookingValidationService` should use the same decision.
- Do not introduce booking imports into generic `server/restaurants/schedule.ts`.
- Do not use capacity service-boundary helpers because they clamp and embed different semantics.

## Operational constraints

- Validate party at the public route boundary.
- Include party in URL/query key.
- Gate stale `keepPreviousData`.
- Fail closed on projection/turn-band errors.
- Preserve atomic capacity RPC authority.
- Treat end-before-close as an application invariant until the RPC is separately hardened.
- Return no guest-eligible overnight slots until the service-date/database design is complete.

## EXPAND

none — circular dependencies, query amplification, stale cache state, public-input validation, disclosure, capacity authority, RPC guarantees, failure behavior, fixed-slot precedence, service-period scope, last-seating scope, and overnight behavior were all checked; no actionable lead remains.
