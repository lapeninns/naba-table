---
task: repo-cleanup
timestamp_utc: 2026-02-02T02:35:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Repository cleanup

## Requirements

- Functional:
  - Remove confirmed dead files and orphaned artifacts with no references.
  - Reduce unused dependencies with high confidence of no usage.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No UI changes expected; avoid altering runtime behavior.
  - Keep backups and task artifacts that are referenced by docs.

## Existing Patterns & Reuse

- Legacy folders are documented in `components/AGENTS.md` and `hooks/AGENTS.md`.
- Task artifacts required under `tasks/<slug>-YYYYMMDD-HHMM>`.

## External Resources

- None.

## Constraints & Risks

- Avoid deleting files referenced in docs or scripts.
- Remove only files with no code references to minimize risk.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Delete confirmed unused modules and orphaned root/temp files only.
- Remove high-confidence unused dependencies to reduce surface area.
