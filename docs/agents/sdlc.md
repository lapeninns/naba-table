# SDLC Phases

Reference for the development lifecycle used in this repo. For binding rules, see root `/AGENTS.md`.

## Phase Overview

| Phase                | What happens                                       | Primary Artifacts            |
| -------------------- | -------------------------------------------------- | ---------------------------- |
| 0. Initiation        | Create task folder, define scope                   | Task folder, stubs           |
| 1. Requirements      | Inventory code, clarify requirements, risks        | research.md                  |
| 2. Design & Planning | Architecture, contracts, UX states, tests, rollout | plan.md                      |
| 3. Implementation    | Code, migrations, components, tests                | todo.md (live checklist)     |
| 4. Verification      | Manual QA, a11y, perf, E2E                         | verification.md + artifacts/ |
| 5. Review & Merge    | PR with evidence, CI green                         | PR                           |
| 6. Release           | Gradual rollout, monitoring                        | Release notes                |
| 7. Operate           | Monitor, hotfix, retrospective                     | Post-release notes           |

## Definition of Ready (Phase 1 exit)

- [ ] Scope and success criteria are clear and measurable
- [ ] Reuse opportunities documented (or "none found")
- [ ] Risks and open questions listed with owners
- [ ] Owner and reviewers assigned

## Definition of Done (Phase 4 exit)

- [ ] Requirements met; success criteria satisfied
- [ ] All tests pass (unit/integration/E2E/a11y)
- [ ] Perf/a11y budgets met; no P0/P1 issues
- [ ] verification.md completed with artifacts
- [ ] Docs/changelogs updated; flags and runbooks documented

## Performance Budgets (mobile, 4× CPU, 4G)

- FCP ≤ 2.0s · LCP ≤ 2.5s · CLS ≤ 0.10 · TBT ≤ 200ms
- Axe: 0 critical/serious issues
- Critical interaction latency: P95 ≤ 500ms

## Templates

See [task-structure.md](task-structure.md) for file templates.

## Waiver / Hotfix Flow

- Use only for urgent P0/P1 hotfixes
- Branch: `hotfix/<slug>-YYYYMMDD-HHMM`
- Minimal research.md/plan.md allowed if risk is documented
- Post-merge within 24h: complete full Phase 4 verification
- Requires maintainer + QA Lead approval; time-boxed ≤72h
