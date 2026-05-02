# Nabatable SDLC OS

This operating layer coordinates agents, constrains blast radius, and forces replayable QA. It is Nabatable-native and assumes the repo truths below are non-negotiable.

## Nabatable truths that control execution

- Nabatable ships two real surfaces:
  - **ops** on the app host via `src/app/app/**`
  - **guest/public** on the root host via `src/app/(public)/**` and `src/app/guest/**`
- `src/proxy.ts` enforces the host split, cross-host redirects, `/app/*` transport behavior, and shared API behavior.
- Supabase is remote-only. Staging-first is mandatory unless the task explicitly states otherwise.
- UI work is **shadcn/ui first**.
  - ops and guest/public use one Radix Luma shadcn theme
- `components/ui/**` is shared primitive territory by default. `src/components/ui/**` and other exported primitives also require a consumer scan before editing.
- Root-host `/dev/**`, internal app-host `src/app/app/dev/**` reached as root-host `/app/dev/**` or app-host `/dev/**` depending on host mode, and `__dev/**` are harness entry points only. They expand state coverage but never replace shipped-route proof.

## Mandatory route or API identity contract

For any task that changes a route, handler, proxy rule, auth gate, or browser QA target, declare this table before editing and keep it current in the task folder or handoff:

| Host context | External path | Internal file or handler | Expected proxy behavior | Auth expectation |
| ------------ | ------------- | ------------------------ | ----------------------- | ---------------- |

Docs-only work may say `Not applicable`.

## Execution order

1. **Frame the work** with `native-execution-loop.md`: assumptions, non-goals, success criteria, and the smallest useful diff.
2. **Classify risk** with `risk-tier-workflow.md`.
3. **Open the task folder** with `task-harness.md` if the work is medium or high risk.
4. **Declare route/API identity and shared-primitive ownership** when the task touches routing, APIs, auth, proxy behavior, or reusable UI.
5. **Plan before editing** when the tier requires it.
6. **Implement inside scope** and keep the task folder current.
7. **Review the result** against the plan, tier, repo invariants, and evidence quality.
8. **Verify by change type** using `verification.md`.
9. **Hand off with evidence** and explicit gaps only.

## File map

| Path                                 | Contract                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| `docs/sdlc/README.md`                | Entry point, repo truths, execution order, and identity gate                         |
| `docs/sdlc/native-execution-loop.md` | Assumption, simplicity, surgical-diff, success-criteria, and evidence loop           |
| `docs/sdlc/risk-tier-workflow.md`    | Risk classification, shared-ownership escalation, and delivery posture               |
| `docs/sdlc/task-harness.md`          | Task-folder rules, route/API identity contract, success criteria, and harness matrix |
| `docs/sdlc/verification.md`          | QA contract, validator-coverage reality, and evidence requirements                   |
| `docs/sdlc/subagents.md`             | Agent coordination sequence and handoff packet contract                              |
| `.agents/planner.md`                 | Planning role contract                                                               |
| `.agents/implementer.md`             | Implementation role contract                                                         |
| `.agents/reviewer.md`                | Review role contract                                                                 |
| `.agents/ui-qa.md`                   | Browser QA role contract                                                             |

## Core operating rules

- Use the lowest honest tier. Escalate immediately when the blast radius expands.
- Convert non-trivial requests into observable success criteria before editing.
- Keep each changed line traceable to the task's success contract.
- Medium/high-risk work must leave a task folder another agent can replay.
- Browser QA is mandatory for UI changes. Real-route evidence comes first.
- Never substitute a harness pass for a shipped-route pass without saying so.
- If a changed JS/TS file sits outside `pnpm run lint` coverage, run targeted eslint or explicitly record the gap.
- Never state that a command, route check, artifact, or env safety check exists unless it was actually run or captured.
