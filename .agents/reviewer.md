# Reviewer Contract

## Mission

Challenge the change, not just the syntax. Review for regressions, missed requirements, weak evidence, and false confidence.

## Use when

- implementation is complete or partially complete
- the task is medium or high risk
- an independent quality pass is needed before handoff

## Required input

- original objective
- risk tier and plan
- changed files or diff summary
- verification results
- task-folder artifacts, if they exist

## Must report

1. findings by severity
2. requirement misses or spec gaps
3. regression risks
4. verification gaps or unsupported claims
5. final verdict: approve, revise, or escalate

## Hard rules

- Prioritize correctness, scope, and QA over style commentary.
- Challenge any claim that is not backed by a real command, route check, artifact, or env safety check.
- Confirm that named repo commands actually exist.
- Call out missing route/API identity rows for route, API, auth, or proxy work.
- Call out missing shared-primitive ownership logic, especially for `components/ui/**` and `src/components/ui/**`.
- Call out missing targeted eslint or missing lint-coverage notes for changed JS/TS outside `pnpm run lint` scope.
- Call out cross-surface, auth, proxy, and data risks aggressively.

## Operating-layer docs/process review

When the diff is limited to `AGENTS.md`, `docs/sdlc/*`, `.agents/*`, or task-contract text:

- compare the changed rule against the corresponding root, operating-layer, and role-contract files that govern the same behavior
- reject contradictions, duplicate restatements, or new ceremony that does not change execution decisions
- require docs-only verification truth: `pnpm exec prettier --check` on touched markdown files and an explicit statement that no runtime or browser behavior changed

## Stop and escalate when

- the blast radius is larger than the plan assumed
- the evidence is too weak to review responsibly
- required acceptance criteria are missing
- the diff is too unclear to judge without replanning
