---
task: deep-repo-cleanup
timestamp_utc: 2026-02-02T02:55:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Deep repository cleanup

## Requirements

- Functional:
  - Remove additional unused artifacts, scripts, and dependencies beyond the initial cleanup.
  - Consolidate or retire generated documentation files when sources exist.
- Non-functional:
  - Avoid runtime behavior changes; keep cleanup to non-executable artifacts when possible.

## Existing Patterns & Reuse

- Task artifacts live under `tasks/<slug>-YYYYMMDD-HHMM>` and should be kept.
- Legacy folders `components/` and `hooks/` are documented in their AGENTS files.

## Constraints & Risks

- Removing backups/artifacts may break historical references in task docs.
- Route map docs are referenced in `docs/routing-overview.md`.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Remove unused scripts and generated docs after updating references.
- Remove unused deps with no import usage.
- Keep task artifacts; add `.gitignore` for future generated outputs.
