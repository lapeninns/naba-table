# Task Harness Contract

Task folders are mandatory for medium- and high-risk work.

## Path

`tasks/<slug>-YYYYMMDD-HHMM>/`

## Required files

| File              | Required content                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `research.md`     | Objective, repo facts, assumptions/tradeoffs, constraints, risks, reuse notes, non-goals, and route/API identity rows when applicable        |
| `plan.md`         | Risk tier, affected surfaces/files, success criteria, implementation sequence, verification plan, stop rules, and shared-ownership decisions |
| `todo.md`         | Live execution checklist with current status                                                                                                 |
| `verification.md` | Exact commands, outcomes, route/API checks, env safety checks, evidence list, and remaining gaps                                             |

## Native starter packet

When opening a medium- or high-risk task, create the required files with these headings before product edits. Keep the packet factual; delete headings only when they are genuinely not applicable and say why.

Do not add a separate `README.md` or `checklist.md` for normal task work. `todo.md` is the checklist, and markdown-native `- [ ]` / `- [x]` checkboxes are the status format.

### `research.md`

```md
## Objective

## Repo facts

## Assumptions and tradeoffs

## Constraints

## Risks

## Reuse notes

## Non-goals

## Route/API identity

| Host context | External path | Internal file or handler | Expected proxy behavior | Auth expectation |
| ------------ | ------------- | ------------------------ | ----------------------- | ---------------- |
```

Use `Not applicable` under route/API identity only when the task has no route, handler, proxy, auth, or browser-QA target impact.

### `plan.md`

```md
## Risk tier

## Affected surfaces and files

## Route/API identity

## Shared-ownership decision

## Success criteria

## Implementation sequence

## Verification plan

## Stop rules
```

### `todo.md`

```md
# Todo

- [ ] Research and scope are current.
- [ ] Plan is approved for the selected tier.
- [ ] Implementation is complete inside scope.
- [ ] Verification is complete and recorded truthfully.
- [ ] Review or self-review is complete for the tier.
```

Maintain exactly one active item while executing. If the scope changes, update `research.md`, `plan.md`, and this checklist before continuing.

### `verification.md`

```md
## Scope verified

## Route/API identity rows exercised

## Commands run

## Real routes or APIs checked

## Harness routes checked

## Env safety checks

## Artifacts captured

## Not run

## Remaining caveats or blockers
```

Record failed, skipped, or unavailable verification as plainly as passed checks. Do not backfill commands after the fact.

## Conditional file

| Path         | When required                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| `artifacts/` | High-risk work, UI/browser evidence, logs, screenshots, traces, or any proof that should be replayable |

## Mandatory route or API identity contract

For any task that changes routes, handlers, proxy behavior, auth gates, or browser QA targets, record a table like this in `research.md` or `plan.md` before editing:

| Host context | External path | Internal file or handler | Expected proxy behavior | Auth expectation |
| ------------ | ------------- | ------------------------ | ----------------------- | ---------------- |

Rules:

- one row per changed route or API boundary
- update the rows if scope changes
- use `Not applicable` only for tasks with no route/API impact

## Harness matrix

| Harness style         | External entry                                                                                                        | Internal source                      | Host / proxy behavior                                                                                                                                   | QA meaning                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Root-host `/dev/**`   | Root host `/dev/**`                                                                                                   | `src/app/(public)/dev/**`            | Root-host pass-through. No app-host redirect. Can exercise guest/public states and some ops-like harnesses, but still lives on harness-only routing.    | Supplemental only; never shipped-route proof                              |
| App-host `app/dev/**` | Root-host transport `/app/dev/**` in single-host mode, or redirect transport to app-host `/dev/**` in multi-host mode | `src/app/app/dev/**`                 | On the app host, `/dev/**` rewrites to internal `/app/dev/**` and follows normal app-host auth expectations unless the route explicitly says otherwise. | Supplemental only; useful for ops state coverage, not shipped-route proof |
| `__dev/**` style      | Private or local-only dev paths such as `src/app/**/__dev/**`                                                         | Same directory family as the harness | No shipped contract. Often absent or gitignored. Treat as isolated scaffolding, not product routing.                                                    | Supplemental only; never cite as shipped behavior                         |

## Lifecycle rules

1. Create the task folder before implementation for medium/high work.
2. Write `research.md` and `plan.md` before editing product files.
3. Keep `todo.md` current during execution. Do not backfill fiction.
4. Update `verification.md` only with commands and checks that actually happened.
5. If the tier escalates, update the task folder before continuing.

## Todo contract

- Keep steps short and actionable.
- Maintain exactly one in-progress item while work is active.
- Mark validation complete only after the required checks pass.

## Verification contract inside the folder

`verification.md` must answer all of these:

- What commands were run, exactly?
- What happened when each command ran?
- Which route/API identity rows were exercised?
- Which real routes or APIs were exercised?
- Which harness routes were exercised, if any?
- Which env safety checks were run, if any?
- What evidence was captured?
- What remains unverified or blocked?

## Task-folder discipline

- One coherent initiative per folder.
- Prefer concise facts over narrative.
- Do not claim browser proof, screenshots, traces, command passes, or env safety passes that do not exist.
- If the work is docs-only, say so and keep verification scoped to the docs that changed.
