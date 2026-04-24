# Task Harness

Task folders are the canonical working unit for Nabatable medium/high-risk delivery.

## Path

`tasks/<slug>-YYYYMMDD-HHMM>/`

Examples:

- `tasks/guest-booking-empty-state-20260424-1015/`
- `tasks/google-business-profile-sync-hardening-20260424-1410/`

## Required files

- `research.md` — current state, constraints, assumptions, scope
- `plan.md` — implementation design and verification plan
- `todo.md` — live checklist during execution
- `verification.md` — what was verified and how
- `artifacts/` — screenshots, traces, JSON, logs, or other evidence when needed

## File roles

### research.md

Capture:

- objective
- current state
- constraints and assumptions
- reuse opportunities
- risks and out-of-scope items

### plan.md

Capture:

- delivery goal
- architecture approach
- files expected to change
- testing and verification strategy
- rollout notes for risky work

### todo.md

Capture:

- small execution steps
- current status
- re-planning notes if scope changes

### verification.md

Capture:

- commands run
- manual checks performed
- artifacts created
- known gaps or follow-up work

## When artifacts are required

Artifacts should be added when:

- UI work needs browser proof
- high-risk work needs evidence
- performance/accessibility results matter
- API behavior needs snapshots or logs
- a maintainer/reviewer will need replayable evidence

## Task-folder discipline

- Keep one task folder per coherent initiative.
- Do not turn task folders into diaries.
- Keep files factual, current, and useful for the next agent or reviewer.
- Update `todo.md` and `verification.md` as the work progresses.
