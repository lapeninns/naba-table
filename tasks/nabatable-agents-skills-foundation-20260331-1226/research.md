---
task: nabatable-agents-skills-foundation
timestamp_utc: 2026-03-31T12:26:26Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Nabatable AGENTS.md and local Codex skill foundation

## Requirements

- Functional:
  - Strengthen the repo's local Codex harness so `AGENTS.md` can rely on project-specific skills instead of only global defaults.
  - Create a small set of repo-local foundation skills that fit Nabatable's actual workflow.
  - Reflect those local skills in root `AGENTS.md` so agents are nudged toward them during normal SDLC execution.
- Non-functional:
  - Keep changes documentation-first and repo-local.
  - Do not relax any root non-negotiables.

## Existing Patterns & Reuse

- Root `AGENTS.md` already defines the SDLC, task artifact discipline, MCP expectations, and skill-trigger rules.
- `.codex/skills/README.md` already reserves the repo-local skill directory but contains no actual local skills.
- The repo already maintains `CONTINUITY.md` and task folders, so a local task-rhythm skill can reinforce existing practice rather than inventing a new one.
- `.factory/skills/fullstack-worker/SKILL.md` and multiple scrutiny syntheses document repeated process gaps around:
  - rigid RED-first wording for regression or verification-first fixes
  - browser verification fallback when `/dev/...` harnesses are stale or auth-gated
  - lack of explicit allowance for test-only work to skip browser proof

## Evidence Driving The New Foundation

- Root `AGENTS.md` references mostly global skills and does not name any repo-local foundational skills.
- `.factory/validation/layout-and-delivery-table/scrutiny/synthesis.json` recommends:
  - allowing regression-first confirmation before adding guard tests
  - clarifying production-path testing over duplicated helpers
  - documenting authenticated-route fallback when the dev harness is stale
- `.factory/validation/queue-and-analytics/scrutiny/synthesis.json` recommends:
  - a concrete browser-validation fallback workflow
  - explicitly allowing browser verification to be skipped for test-only tasks
- `.factory/validation/actions-and-realtime/scrutiny/synthesis.json` repeats the same process drift.

## Recommended Direction

- Add three repo-local Codex skills:
  1. `nabatable-task-harness`
     - for AGENTS traversal, task-folder setup, continuity updates, and artifact discipline
  2. `nabatable-ui-proof`
     - for Chrome DevTools / browser verification with authenticated-route and stale-harness fallback rules
  3. `nabatable-fullstack-delivery`
     - for feature vs regression vs test-only implementation workflow, emphasizing canonical path testing and documented deviations
- Update root `AGENTS.md` to:
  - advertise these as repo-local foundation skills
  - reference them in the main SDLC table and phase guidance
  - keep global skills as complements, not the only option

## Constraints & Risks

- Avoid making the new local skills generic duplicates of global skills.
- Keep the new skills specialized to Nabatable's actual architecture and recurring failure modes.
- Avoid broad AGENTS refactors; focus on discovery and invocation value.

## Open Questions

- None blocking. The repo already provides enough evidence for an initial foundation pass.
