---
name: nabatable-task-harness
description: Safely implement and verify Nabatable changes across the Next.js app and Cloudflare Workers.
---

# Nabatable task harness

Use this skill for repository implementation work.

## Start

1. Read `AGENTS.md` and the source-of-truth document closest to the task.
2. Confirm the current branch and preserve unrelated working-tree changes.
3. Identify the affected application, boundary, risk, and smallest executable proof.
4. Run the narrow baseline before editing.

## Implement

- Write a failing test first for behavior changes.
- Keep request validation at entry points and domain logic outside route handlers.
- Preserve tenant isolation, idempotency, log redaction, and remote-only database safeguards.
- Add structured logs, metrics, and trace context for new failure modes.

## Verify

Run the application-level test, then the repository gates that match the blast radius:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm verify:workspaces
pnpm build
```

For UI changes, add browser evidence from a shipped route. For schema or production integration changes, use staging readback and never substitute mocks for remote invariants.

## Handoff

Report changed behavior, exact commands and results, remaining external checks, rollback, and any production action that still requires a human decision.
