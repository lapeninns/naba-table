# Claim graph

## Verified claims

Pending.

| claim_id | statement | type | risk | scope | intent | support | contradiction | groups | convergence | counter-search | primary | dependencies | status | synthesis |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C1 | `service_availability` describes bookable appointment slots. | documentation semantics | normal | Actions Center appointments | I1 | pending | pending | pending | pending | pending | official docs | none | unresolved | pending |
| C2 | `service_hours` constrain appointment start timestamps, not necessarily full containment. | documentation semantics | high | Actions Center appointments | I2 | pending | pending | pending | pending | pending | official docs | C1 | unresolved | pending |
| C3 | `business_hours` constrain appointment start timestamps, not necessarily full containment. | documentation semantics | high | Actions Center appointments | I3 | pending | pending | pending | pending | pending | official docs | C1 | unresolved | pending |
| C4 | No official page explicitly states a full-containment rule for service or business hours. | absence claim | high | Actions Center appointments | I4 | pending | pending | pending | pending | pending | official docs | C2,C3 | unresolved | pending |
