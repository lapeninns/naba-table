---
task: repo-cleanup
timestamp_utc: 2025-12-26T00:08:11Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Research: Repo cleanup

## Requirements

- Functional:
  - Produce a dry-run inventory of files/folders slated for removal (unnecessary files/folders, all SQL files, all migration files, pgsql/postgres data, and past task folders).
  - Remove items only after explicit approval of the dry-run list.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Ensure no secrets are introduced or exposed.
  - Preserve required policy files (e.g., `/AGENTS.md`) to avoid CI failures.

## Existing Patterns & Reuse

- .gitignore and lint ignore lists define common generated artifacts (node_modules, .next, coverage, playwright reports, build outputs).
- `supabase/migrations` holds migration SQL files; there are also task artifacts containing SQL.

## External Resources

- None.

## Constraints & Risks

- Destructive deletions may break builds, DB history, or compliance requirements.
- `/AGENTS.md` must remain in place (CI enforcement).
- Repo policy requires a task folder and research/plan before changes.

## Open Questions (owner, due)

- None (user confirmed to delete all SQL, migration files, pgsql/postgres artifacts, and past task folders; dry-run required first).

## Recommended Direction (with rationale)

- Inventory candidate deletions by category, present for approval, then perform deletions in a single, explicit step to avoid accidental loss.
