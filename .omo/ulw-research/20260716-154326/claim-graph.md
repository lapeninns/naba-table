# Claim graph

## Verified claims

Pending.

## Claims

| claim_id | statement | type | risk | scope | intent_ids | support | contradiction | observation groups | convergence | counter-search | primary | dependencies | status | synthesis |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C1 | `start_sec` denotes slot start time. | semantic | normal | Actions Center | I1 | Pending | Pending | Pending | pending | Pending | Google docs | none | unresolved | Pending |
| C2 | `duration_sec` denotes slot duration. | semantic | normal | Actions Center | I1 | Pending | Pending | Pending | pending | Pending | Google docs | none | unresolved | Pending |
| C3 | `spots` denotes bookable capacity. | semantic | normal | Actions Center | I1 | Pending | Pending | Pending | pending | Pending | Google docs | none | unresolved | Pending |
| C4 | Availability duration has a documented relation to service duration/time ranges. | semantic | high | Actions Center | I2 | Pending | Pending | Pending | pending | Pending | Google docs | C1,C2 | unresolved | Pending |
| C5 | Merchant close constrains slot end. | constraint | high | Actions Center | I3 | Pending | Pending | Pending | pending | Pending | Google docs | C1,C2,C4 | unresolved | Pending |
| C6 | Availability can be independently supplied outside merchant hours. | constraint | high | Actions Center | I4 | Pending | Pending | Pending | pending | Pending | Google docs | C1-C5 | unresolved | Pending |
