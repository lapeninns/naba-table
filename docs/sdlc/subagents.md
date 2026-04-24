# Subagent Operating Model

Nabatable should use subagents when isolation, specialization, or parallelism improves quality.

## When to use subagents

Use specialist roles when:

- planning and implementation need different skill shapes
- review must be independent from implementation
- UI QA needs browser-specific attention
- parallel research or analysis can reduce context load

Do not use subagents for trivial linear work that one agent can complete directly.

## Default role set

- `.agents/planner.md`
- `.agents/implementer.md`
- `.agents/reviewer.md`
- `.agents/ui-qa.md`

## Role contracts

### Planner

Best for:

- requirements clarification
- impact mapping
- file/change planning
- acceptance criteria
- risk classification

### Implementer

Best for:

- making the scoped change
- preserving local patterns
- running focused validation
- updating task artifacts during execution

### Reviewer

Best for:

- finding regressions
- checking spec compliance
- checking code quality and risk gaps
- challenging assumptions

### UI QA

Best for:

- browser verification
- responsive checks
- accessibility spot-checks
- route-level UX validation

## Suggested flow

For medium/high-risk work:

1. Planner defines scope, tier, and affected files.
2. Implementer executes the smallest viable slice.
3. Reviewer inspects for regressions and missed requirements.
4. UI QA validates user-facing work when applicable.

## Coordination rules

- Pass explicit inputs and expected outputs to each role.
- Keep each role narrow; avoid giant multi-purpose subagents.
- The reviewer should not simply restate the implementer’s summary.
- UI QA should focus on user-observable behavior, not code style.

## Stop rules

Escalate back to the main thread when:

- requirements are contradictory
- a change crosses risk tiers unexpectedly
- the required toolset is unavailable
- a role discovers a repo-wide policy issue rather than a task-local problem
