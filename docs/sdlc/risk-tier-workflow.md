# Risk-Tier Workflow

Nabatable uses a risk-tier model so the process scales with the change.

## Tier definitions

### Low risk

Typical examples:

- copy changes
- narrow bug fixes
- small styling adjustments
- isolated refactors with no contract change
- test-only changes for an already agreed behavior

Required process:

1. Inspect the touched files first.
2. Make the minimal change.
3. Run focused verification.
4. Summarize assumptions and residual risk.

Recommended outputs:

- no task folder required unless the work grows
- concise final summary

### Medium risk

Typical examples:

- new feature work in one domain
- route changes
- new UI component or workflow
- API route additions/changes
- reusable shared component work
- moderate refactors

Required process:

1. Create `tasks/<slug>-YYYYMMDD-HHMM>/`.
2. Write `research.md`.
3. Write `plan.md`.
4. Track implementation in `todo.md`.
5. Record verification in `verification.md`.

Recommended outputs:

- explicit acceptance criteria
- affected files list
- focused verification matrix

### High risk

Typical examples:

- database migrations or destructive data changes
- auth/session/security changes
- cross-cutting architecture refactors
- billing/notifications/compliance flows
- changes that can break both ops and guest surfaces

Required process:

1. Create a task folder.
2. Finish research and plan before code changes.
3. Define rollback and failure handling.
4. Capture verification evidence in `artifacts/`.
5. Prefer specialist review before merge.

Recommended outputs:

- rollout notes
- explicit blast-radius statement
- evidence attached to verification

## Escalation rules

Escalate to the next tier if any of the following become true:

- the change touches more than one major surface
- data contracts change
- auth or permissions change
- the UI change spans multiple routes or reusable primitives
- unexpected complexity appears during implementation

## De-escalation rule

Do not keep ceremony that no longer matches the task. If a task was created as medium/high risk but the final code change becomes trivial, keep the existing artifacts but do not expand process overhead unnecessarily.

## Nabatable-specific defaults

- Any UI change requires manual browser QA.
- Any Supabase write-path or schema-path work is high risk by default.
- Any guest-facing booking funnel change is at least medium risk.
- Any operator-dashboard route or navigation change is at least medium risk.
