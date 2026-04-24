# Agent Coordination Contract

Use role handoffs when specialization improves execution quality or verification quality. The default Nabatable sequence is below.

## Standard sequence

1. **Planner** sets scope, tier, route/API identity, affected surfaces, and verification targets.
2. **Implementer** edits files, keeps the task folder current, and runs required validators.
3. **Reviewer** challenges regressions, scope drift, weak evidence, and ownership mistakes.
4. **UI QA** verifies browser behavior for UI work on real routes first, harnesses second.

## When the full sequence is required

- high-risk work
- medium-risk work, except docs/process-layer rewrites limited to `docs/sdlc/*`, `.agents/*`, or task-contract text may combine roles under the rule below
- any UI change that needs browser verification
- any edit in `components/ui/**` or shared primitives with cross-surface impact
- any change where review should be independent from implementation

## When roles may be combined

- low-risk non-UI work with an obviously narrow blast radius
- medium-risk docs/process-layer work only when the change is docs-only, does not alter shipped code or runtime behavior, and the same agent still preserves the full medium-risk contract: explicit tier/scope planning, required task-folder evidence, validator execution, and a factual self-review in planner → implementer → reviewer order

## Mandatory handoff packet

Every handoff should include:

- objective
- risk tier and reason
- task-folder path, if one exists
- affected hosts, surfaces, routes, APIs, and files
- route/API identity table, or `Not applicable`
- shared-primitive ownership decision when reusable UI is involved
- required verification
- open risks, assumptions, blocked environment access, or validator-coverage gaps

## Coordination rules

- Do not hand off vague goals. Hand off executable scope.
- Keep app-host and root-host behavior explicit whenever routes are involved.
- Keep real-route verification separate from harness verification in every handoff.
- If `components/ui/**` is touched, assume high risk until the parent thread says otherwise.
- If the task escalates in risk, return to planning before continuing.

## Role ownership

| Role        | Owns                                                                                  |
| ----------- | ------------------------------------------------------------------------------------- |
| Planner     | Scope, tiering, route/API identity, shared-ownership call, and verification plan      |
| Implementer | File edits, task-folder upkeep, validator execution, and factual verification capture |
| Reviewer    | Regression review, requirement coverage, ownership challenges, and evidence quality   |
| UI QA       | Browser proof, responsive coverage, host labeling, and harness labeling               |

## Escalation triggers

Escalate back to the parent thread when:

- the task crosses risk tiers
- required verification cannot be run
- auth, proxy, Supabase, or shared-primitive scope expands unexpectedly
- the assigned role can no longer complete its contract responsibly
