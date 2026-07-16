# Intent Diff

| intent_id | expected truth | observed reality | diff | violated invariant | intent source | supporting observations | status | linked claim ids |
|---|---|---|---|---|---|---|---|---|
| I1 | Official OpenTable materials document how imported/channel reservations are identified and deduplicated. | Pending research. | Unknown. | Booking identity must survive retries and cross-channel ingestion. | Assignment scope. | Pending. | unknown | C1 |
| I2 | Official materials document how availability-affecting settings synchronize or conflict. | Pending research. | Unknown. | Inventory should not oversell across hours, shifts, closures, pacing, durations, and table state. | Assignment scope. | Pending. | unknown | C2 |
| I3 | Official materials document POS reservation/status synchronization and its limits. | Pending research. | Unknown. | Status changes should propagate safely and idempotently. | Assignment scope. | Pending. | unknown | C3 |
| I4 | Official materials document retry, duplicate, partial-failure, override, cancellation, and deletion behavior. | Pending research. | Unknown. | Failure recovery must not duplicate, lose, or resurrect bookings. | Assignment scope. | Pending. | unknown | C4 |
