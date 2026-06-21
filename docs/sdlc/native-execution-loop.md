# Native Execution Loop

This is Nabatable's adaptation of the Karpathy-inspired coding-agent guidance in [`forrestchang/andrej-karpathy-skills`](https://github.com/forrestchang/andrej-karpathy-skills). Use it to turn a request into a small, verifiable change that respects this repo's host split, Supabase policy, shadcn/Radix boundaries, task folders, and evidence rules.

The point is not more ceremony. The point is fewer silent assumptions, smaller diffs, and handoffs that another agent can replay.

## Loop

### 1. Name ambiguity before work

Before editing, state the assumptions that affect scope, data, auth, routing, UI surface, or verification. If more than one interpretation is plausible and the choice changes risk or behavior, either ask the user or narrow the scope explicitly.

Do not ask for clarification when the repo gives a safe answer. Use the existing route tree, component ownership, task docs, package scripts, and environment contracts first.

### 2. Convert the request into a success contract

Every non-trivial task needs a concrete target:

- objective
- non-goals
- affected surface, route, API, data path, or shared primitive
- route/API identity rows, or `Not applicable`
- shared-ownership decision, or `Not applicable`
- success criteria stated as observable outcomes
- exact verification that would prove those outcomes

For medium/high-risk work, this contract belongs in the task folder before product edits.

### 3. Choose the smallest useful diff

Prefer the repo's existing patterns over new mechanisms. Reuse shadcn primitives, server helpers, hooks, test utilities, and task-harness structure before inventing another abstraction.

Keep each changed line traceable to the success contract. Do not refactor adjacent code, rewrite comments, normalize formatting, add optional configuration, or clean up pre-existing dead code unless the current task requires it.

When your own edit creates unused imports, variables, tests, docs, or routes, clean up that new fallout.

### 4. Verify, then decide

Run the checks that match the change type in `verification.md`. If a check fails, treat that result as new evidence: either fix inside scope, update the plan if scope changes, or record the blocker.

Never turn a harness pass into shipped-route proof. Never turn a static code read into runtime verification. Never claim a command or browser check that was not performed.

### 5. Hand off with evidence

The final handoff should let another agent continue without rediscovery:

- files changed
- contract or behavior changed
- commands and route/API checks actually run
- artifacts captured, if any
- unresolved gaps or residual risk

For docs-only work, say plainly that no runtime or browser behavior changed.

## Tier behavior

- **Low:** a short inline contract is enough when the blast radius is genuinely narrow.
- **Medium:** create the task folder, record assumptions and success criteria, and keep verification evidence current.
- **High:** include containment or rollback thinking before edits, then use the strongest matching verification and independent review expected by `subagents.md`.

## Stop Rules

Stop and re-plan when:

- the request cannot be interpreted without guessing across route, auth, data, or surface boundaries
- the smallest useful diff would still touch both shipped surfaces or shared primitives
- Supabase work cannot honor remote-only and staging-first policy
- required verification is blocked or no longer proves the success criteria
- the implementation starts adding speculative features or abstractions

## Bad Smells

- "While I was here" edits.
- A task folder whose `verification.md` only lists intentions.
- A plan that names files but not observable success.
- A UI change proven only by a `/dev/**` or `__dev/**` harness.
- A data change without target environment, safety checks, and read-after evidence.
- A reviewer approving claims that are not backed by commands, routes, artifacts, or env checks.
