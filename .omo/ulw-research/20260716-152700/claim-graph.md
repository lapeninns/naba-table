# Claim graph

## Verified claims

- C1: Plan and Create currently disagree because Plan lacks party-aware duration while Create enforces end-by-close.
- C2: The composed formula is required if the configured last-seating buffer is intended to remain an active policy.
- C3: Existing operating-hours columns are sufficient; no kitchen-specific columns are needed.

| claim_id | statement | claim type | risk tier | scope | intent ids | supporting observations | contradicting observations | independent observation groups | convergence status | counter-search result | primary source backing | dependencies | status | final synthesis location |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C1 | Slot generation and booking creation should share one finish-by-boundary eligibility function. | architectural | high | booking availability | I1 | Slot/create call-chain research and passing focused tests. | Current start-only regression. | slot generation + create validation + history | converged | Searches found no alternate party-aware Plan path. | Repository code and tests. | C3 | supported | `SYNTHESIS.md` |
| C2 | Last-seating buffer can be enforced as an independent latest-start cap, composed with canonical duration as `close - max(buffer,duration)`. | architectural | high | guest availability | I2 | Formula execution; history; settings contract; create and edge-case lanes. | Duration-only is the smaller compatibility fix if buffer is deprecated. | settings + create + arithmetic + history | converged with product fork | Buffer-only and shortening counterexamples refuted alternatives. | Repository code, history, and executed proof. | C1,C3 | supported | `SYNTHESIS.md` |
| C3 | Existing operating-hours columns function as kitchen open and close boundaries. | schema/semantic | normal | schedule settings | I3 | `types/supabase.ts:2790`; `WeeklyScheduleCard.tsx:199`; server schedule reads. | No dedicated kitchen-named column. | schema + UI + server | converged | No kitchen-specific schema field found. | Generated Supabase schema and application UI. | none | supported | `SYNTHESIS.md` |
