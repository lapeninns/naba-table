---
task: fix-agent-readiness-report
timestamp_utc: 2026-01-30T12:43:00Z
owner: github:@unknown
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Fix Agent Readiness Issues

## Objective

Increase the agent readiness score by addressing all criteria marked 0/1 in `AGENT_READINESS_REPORT.md`, primarily via CI automation, tests, and lightweight tooling.

## Success Criteria

- [ ] Each previously failing criterion has a concrete implementation (or a documented N/A with justification in-task).
- [ ] CI runs the new checks (or safely skips when secrets are missing, with clear messaging).
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test:ci` pass locally.

## Architecture & Components

- CI additions live under `.github/workflows/`.
- Repo policy/validation scripts live under `scripts/`.
- Test configuration changes live under `vitest.config.ts` (and `reserve/vitest.config.ts` if needed).

## Data Flow & API Contracts

- N/A (tooling/CI-oriented changes).

## UI/UX States

- N/A.

## Edge Cases

- CI jobs requiring secrets should fail fast with a clear message when secrets are missing, or be guarded behind explicit opt-in.
- Avoid introducing long-running jobs without timeouts.

## Testing Strategy

- Unit: existing Vitest suite; raise coverage thresholds modestly to avoid brittle gating.
- Integration/E2E: ensure Playwright jobs and tests are discoverable and runnable.
- Security: add DAST baseline scan workflow and make it runnable with a localhost target.

## Rollout

- Treat new CI checks as additive, then tighten thresholds in follow-ups if needed.
