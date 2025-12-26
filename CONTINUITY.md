# Continuity Ledger

Last updated: 2025-12-26T00:08:54Z

## Goal (incl. success criteria)

- Clean the repo by removing unnecessary files/folders, all SQL files, all migration files, all pgsql/postgres artifacts, and all past task folders after approval of a dry-run list.

## Constraints/Assumptions

- Follow AGENTS SDLC; no destructive changes before research/plan and explicit approval of the dry-run list.
- Preserve required policy files (e.g., `/AGENTS.md`) to avoid CI failures.
- Remove all SQL and migration files, plus pgsql/postgres artifacts, per user confirmation.
- Remove all past `tasks/*` folders (retain the new task folder).

## Key decisions

- Use a dry-run inventory grouped by category; delete only after explicit approval.
- Default task metadata set to `github:@maintainers` (can be revised if needed).

## State

- Phase 1/2 complete for repo cleanup; dry-run inventory pending.

## Done

- Created `tasks/repo-cleanup-20251226-0008/` with `research.md`, `plan.md`, `todo.md`, and `verification.md`.
- Captured cleanup scope, constraints, and approach in Phase 1/2 artifacts.

## Now

- Produce dry-run inventory for deletion approval.

## Next

- Share dry-run list for approval.
- Delete approved files/folders and summarize the result.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- `tasks/repo-cleanup-20251226-0008/`
- `CONTINUITY.md`
