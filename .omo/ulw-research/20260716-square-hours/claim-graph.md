# Claim Graph

## Verified claims

Pending.

## Nodes

| claim_id | statement | claim type | risk tier | scope | intent ids | supporting observations | contradicting observations | independent observation groups | convergence status | counter-search result | primary source backing | dependencies | status | final synthesis location |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C1 | Location business hours are modeled separately from appointment availability. | documentation | normal | Square official docs | I1-I2 | Pending | Pending | Pending | open | Pending | Pending | None | unresolved | Pending |
| C2 | Online booking hours can differ from Location business hours. | documentation | normal | Square official docs | I2 | Pending | Pending | Pending | open | Pending | Pending | C1 | unresolved | Pending |
| C3 | Square explicitly requires appointments to end by Location closing time. | documentation | high | Square official docs | I3 | Pending | Pending | Pending | open | Pending | Pending | C1-C2 | unresolved | Pending |
| C4 | Staff schedules constrain appointment availability. | documentation | normal | Square official docs | I4 | Pending | Pending | Pending | open | Pending | Pending | C2 | unresolved | Pending |
| C5 | Custom availability can override or augment recurring schedules. | documentation | normal | Square official docs | I4 | Pending | Pending | Pending | open | Pending | Pending | C4 | unresolved | Pending |
| C6 | Processing time changes availability/overlap behavior. | documentation | normal | Square official docs | I4 | Pending | Pending | Pending | open | Pending | Pending | C4 | unresolved | Pending |
| C7 | Padding or blocked time changes adjacent slot eligibility. | documentation | normal | Square official docs | I4 | Pending | Pending | Pending | open | Pending | Pending | C4 | unresolved | Pending |
| C8 | Appointment scheduling is time-zone aware and can span multiple configured time zones. | documentation | normal | Square official docs | I4 | Pending | Pending | Pending | open | Pending | Pending | C1-C4 | unresolved | Pending |
