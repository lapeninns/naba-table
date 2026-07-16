# Claim graph: Square Bookings API semantics

## verified-claims

Pending research.

| claim_id | statement | type | risk | scope | intent_ids | supporting observations | contradicting observations | independent groups | convergence | counter-search | primary source | dependencies | status | synthesis location |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C1 | Square service duration semantics. | API schema | normal | Square Bookings/Catalog | I1 | Pending | Pending | Pending | pending | Pending | Pending | none | unresolved | Pending |
| C2 | Availability temporal-range semantics. | API schema | normal | Square Bookings | I2 | Pending | Pending | Pending | pending | Pending | Pending | C1 | unresolved | Pending |
| C3 | Booking start/end semantics. | API schema | normal | Square Bookings | I3 | Pending | Pending | Pending | pending | Pending | Pending | C1 | unresolved | Pending |
| C4 | Lead-time/cutoff/advance-window controls. | product/API policy | normal | Square Bookings | I4 | Pending | Pending | Pending | pending | Pending | Pending | none | unresolved | Pending |
| C5 | Location business-hours representation and effect. | API schema/policy | normal | Square Locations/Bookings | I5 | Pending | Pending | Pending | pending | Pending | Pending | none | unresolved | Pending |
| C6 | Restaurant applicability is direct or inferential. | scope inference | high | Restaurant reservations | I6 | Pending | Pending | Pending | pending | Pending | Pending | C1-C5 | unresolved | Pending |
| C7 | Current/deprecated API boundary. | versioning | normal | Square Bookings | I7 | Pending | Pending | Pending | pending | Pending | Pending | C1-C5 | unresolved | Pending |
