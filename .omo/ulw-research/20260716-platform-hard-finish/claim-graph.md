# Claim graph

## Verified claims

Pending convergence and counter-search.

| claim_id | Statement | Type | Risk | Scope | Intent ids | Supporting observations | Contradicting observations | Independent groups | Convergence | Counter-search | Primary backing | Dependencies | Status | Synthesis |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C1 | Some reservation platforms define a service/reservation end as the final guest finish time. | terminology/configuration | normal | cross-platform | I1 | Pending | Pending | Pending | open | Pending | Pending | none | unresolved | Pending |
| C2 | Under hard-finish semantics, duration by party size back-calculates the final reservable start. | configuration rule | normal | cross-platform | I2 | Pending | Pending | Pending | open | Pending | Pending | C1 | unresolved | Pending |
| C3 | Operating/opening hours and reservation availability are separate concepts. | terminology/configuration | normal | cross-platform | I3 | Pending | Pending | Pending | open | Pending | Pending | none | unresolved | Pending |
| C4 | “End time” is vendor- and workflow-specific and can mean either last start or final finish. | contradiction | normal | cross-platform | I4 | O1 | Pending | 1 | open | Pending | Tock pending | none | partial | Pending |
