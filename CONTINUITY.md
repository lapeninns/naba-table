# Continuity Ledger

Last updated: 2026-01-26T10:40:02Z

## Goal (incl. success criteria)

- Address table assignment pitfalls (hardening/behavior fixes).
- Success: adjacency always enforced (connected); strictness enforced; pruning guardrails added with tests.

## Constraints/Assumptions

- Follow AGENTS.md SDLC phases; no coding before requirements/plan.
- Everything is a task with `tasks/<slug>-YYYYMMDD-HHMM>/` artifacts.
- Use codebase-retrieval for code search before edits.
- Behavior changes allowed; apply in strict mode.

## Key decisions

- Adjacency enforcement is always on with connected-mode evaluation.
- Strict policy: enforce zone lock in quote, disallow capacity overflow fallback, fail fast on hold conflicts.
- Keep pruning limits; add guardrails/telemetry and determinism.

## State

- Phase 4 (Verification) - hardening implemented and tests run.

## Done

- Read root `AGENTS.md` and `CONTINUITY.md`.
- Loaded Continuity Ledger skill.
- Created task folder `tasks/table-assignment-refactor-20260126-0031/` with SDLC stubs.
- Located candidate table assignment code via codebase-retrieval.
- Read `server/AGENTS.md`.
- Updated `research.md` with initial findings and open questions.
- Updated `research.md` with confirmed scope and refactor-only requirement.
- Drafted `plan.md` for refactor across all layers.
- Plan approved by user; proceed to implementation.
- Refactored selector, quote, assignment, direct-assignment, and v2 planner helpers (behavior preserved).
- Added selector unit tests and ran `pnpm run test -- tests/server/capacity/selector.test.ts`.
- Created task `tasks/table-assignment-hardening-20260126-0938/` with SDLC stubs.
- Removed requireAdjacency overrides across API/services/assignment flows and hardcoded connected enforcement.
- Updated docs and manual/quote/assignment metadata to remove adjacency overrides.
- Ran `pnpm run test -- tests/server/capacity/selector.test.ts`.
- Added adjacency-failure telemetry in quote flow with table set details.
- Added `scripts/capacity-load-test.ts` for allocator load testing and executed heavier runs against Old Crown Girton (pre-staging).
- Ran capacity selector/quote tests after telemetry changes.
- Added adjacency edge-case unit tests and re-ran selector tests.
- Documented adjacencyFailure dashboards/alerts in production readiness.

## Now

- Summarize changes and await feedback.

## Next

- Address any follow-up requests.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- AGENTS.md
- CONTINUITY.md
- tasks/table-assignment-refactor-20260126-0031/research.md
- tasks/table-assignment-refactor-20260126-0031/plan.md
- server/AGENTS.md
- server/capacity/selector.ts
- server/capacity/table-assignment/quote.ts
- server/capacity/table-assignment/assignment.ts
- server/capacity/table-assignment/quote.ts
- server/capacity/selector.ts
- server/feature-flags.ts
- lib/env.ts
- config/env.schema.ts
- docs/BUSINESS_LOGIC.md
- .env.example
- tests/server/capacity/feature-flags.test.ts
- tests/server/capacity/quote-strictness.test.ts
- tasks/table-assignment-hardening-20260126-0938/todo.md
- tasks/table-assignment-hardening-20260126-0938/verification.md
