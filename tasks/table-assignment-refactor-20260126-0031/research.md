---
task: table-assignment-refactor
timestamp_utc: 2026-01-26T00:31:19Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Table Assignment Algorithm Refactor

## Requirements

- Functional:
  - Preserve current table assignment behavior across all layers (selection, quote, assignment).
  - Refactor all layers involved in table assignment without changing outputs.
  - Keep single source of truth for selection/scoring logic.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Performance-sensitive path (capacity/booking flow).
  - Deterministic results for same inputs.
  - Validate external inputs at boundaries only.

## Existing Patterns & Reuse

- Core selector algorithm: `server/capacity/selector.ts` (`buildScoredTablePlans`, `enumerateCombinationPlans`).
- Table assignment orchestration: `server/capacity/table-assignment/assignment.ts`.
- Manual/direct assignment path: `server/capacity/table-assignment/direct-assignment.ts`.
- Quote flow uses selector: `server/capacity/table-assignment/quote.ts`.
- v2 planner wrapper reuses selector: `server/capacity/v2/planner.ts`.

## External Resources

- N/A

## Constraints & Risks

- Constraints: server domain rules (deterministic, separate IO from logic); no UI changes expected.
- Risk: algorithm changes could alter booking outcomes or performance.
- Risk: adjacency/zone/seed limiting heuristics are intertwined; refactor must preserve diagnostics.

## Open Questions (owner, due)

- Q: Which module owns the table assignment algorithm?
  A: `server/capacity/selector.ts` is core, but scope includes all layers (assignment/quote/v2 planner).
- Q: Is this a refactor-only change or should behavior change (weights/heuristics)?
  A: Refactor-only; identical behavior required.
- Q: Any regressions or scenarios to target?
  A: UNCONFIRMED

## Recommended Direction (with rationale)

- Refactor `buildScoredTablePlans` and `enumerateCombinationPlans` into smaller pure helpers while keeping IO outside.
- Sweep assignment/quote/v2 planner layers for duplicated logic and unify where appropriate.
- Add/extend tests for key scenarios (single table, combinations, adjacency required, capacity caps, seed limiting).
