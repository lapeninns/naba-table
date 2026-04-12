---
task: ai-rule-doc-deletion-dry-run
timestamp_utc: 2026-04-12T17:34:33Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research

## Request

- User asked for a dry run to delete all `AGENTS.md`, design-system markdown files, and other markdown files that provide rules/instructions for AI.
- This turn is discovery only: do not delete anything yet.

## Known constraints

- Root `AGENTS.md` says not to delete/move/overwrite files without explicit user request. The user has requested deletion, but also explicitly requested a dry run first.
- Need to separate clear deletion candidates from ambiguous files before any destructive action.

## Initial inventory

- Found 15 `AGENTS.md` files in the repo, which are the clearest rule files matching the request.
- Found 3 design-system markdown files under `docs/`:
  - `docs/design-system.md`
  - `docs/auth-design-system.md`
  - `docs/design-system-consistency-audit.md`
- Found additional likely AI-workflow docs that are plausible but ambiguous for deletion scope:
  - `CONTINUITY.md`
  - `.codex/prompts/README.md`
  - `.codex/skills/README.md`
  - `.codex/skills/nabatable-task-harness/SKILL.md`
  - `.codex/skills/nabatable-fullstack-delivery/SKILL.md`
  - `.codex/skills/nabatable-ui-proof/SKILL.md`
  - `missions/34cdd665-d064-4743-8749-db6f01b14151/*.md` process docs

## Open questions

- What should count as "many others" beyond `AGENTS.md` and design-system docs?
- Should repo-local `.codex` prompt/skill docs be included in the eventual deletion scope?
