# Expansion log

## Phase 0

- Core question: Which booking eligibility rule should be authoritative, where should it live, and how should it compose service close, last-seating buffer, party-size turn duration, timezone, overrides, and overnight windows without creating false availability?
- Axes:
  - Slot-generation path and its inputs.
  - Create/confirm validation path and interval arithmetic.
  - Tests and Git history that encode intended behavior.
  - Settings/API/UI propagation for last-seating buffer and turn bands.
  - Database/RPC capacity invariants and service-window semantics.
  - External reservation-platform and scheduling standards/practices.
  - Skeptical design review for edge cases and migration risk.
- Codebase relevant: yes.
- External research: yes.
- Browsing: yes.
- Verification likely: yes.
- Final material: Markdown synthesis, because the requested outcome is a solution rather than a formal report artifact.

## Wave 1: saturation

- Workers: slot generation, create validation, tests/history, settings contract, database/capacity, industry practice, edge-case skeptic.
- Principal leads:
  - Resolve the conflicting historical product rules.
  - Determine fixed-slot precedence.
  - Choose the correct buffer-duration composition.
  - Define the party-aware API seam.
  - Bound overnight behavior.
- Closed dead ends:
  - No initial guest use of `/api/availability`.
  - No hidden last-seating runtime consumer.
  - No later replacement capacity RPC in repository history.
  - No universal external meaning of “close.”

## Wave 2: targeted expansion

- Workers:
  - Industry-practice lane mapped Nabatable’s internal contract to external hard-finish/latest-arrival models.
  - Database/capacity lane resolved fixed-slot precedence and the party-aware projection boundary.
- Outcome:
  - Under the user’s stated finish-by-close intent, the internal ambiguity closes in favor of two independent constraints.
  - Fixed slots remain candidates; they do not waive end-before-close or last seating.
  - Generic schedule remains unchanged; guest projection becomes party-aware.
- Remaining lead:
  - Stress-test the proposed seam for compatibility, imports, query amplification, stale caches, and security boundaries.

## Wave 3: counter-search and boundary critique

- Workers:
  - Industry-practice counter-search tested global, latest-arrival, client-side, whole-day availability, and service-period-end alternatives.
  - Database/capacity critique tested circular dependencies, N+1 risk, stale query data, input validation, disclosure, failure behavior, and RPC authority.
- Outcome:
  - Proposal passed with corrections recorded in the wave-3 digests.
  - Zero unchecked research leads remain.
- Convergence reason: all in-scope leads were investigated or closed; remaining overnight service-date and live database questions are explicitly separate implementation/migration decisions.
