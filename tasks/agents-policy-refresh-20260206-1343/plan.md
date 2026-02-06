---
task: agents-policy-refresh
timestamp_utc: 2026-02-06T13:43:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Agent Rules + MCP Alignment

## Objective

Align all agent governance documentation with how we actually operate in this environment, so agents do not plan around unavailable tooling and the repo has a single, consistent source of truth.

## Success Criteria

- [ ] `/AGENTS.md` reflects this session’s non-negotiables and safety guards.
- [ ] No remaining references to unavailable MCPs (`DeepWiki`, `Next DevTools`) in agent policy files.
- [ ] Nested `AGENTS.md` files are bumped to agents_version `5.4` with an updated `last_updated`.
- [ ] Branch naming guidance is compatible with Codex branch prefix constraints.
- [ ] Repo has an explicit place for repo-local skills/prompts (`.codex/skills`, `.codex/prompts`).

## Changes

- Update `/AGENTS.md`:
  - Add missing non-negotiables (production-grade, canonical codepath, direct integrations, single source of truth, fail-fast invariants, latest docs).
  - Add explicit "Security & Safety Guards" section (no deletes/moves without explicit request, secrets, validation, auth, dependency caution).
  - Replace MCP references:
    - Remove `DeepWiki MCP` and `Next DevTools MCP`
    - Add `Codebase Retrieval (Augment)` and `PostHog` (if applicable)
    - Clarify Context7’s role (library docs/examples)
  - Add skills/prompts guidance and shell discipline.
  - Update git branching guidance (Codex prefix).
- Update nested `AGENTS.md` files:
  - Frontmatter: `agents_version: 5.4`, `last_updated: 2026-02-06`
  - Remove/replace any references to unavailable MCPs (notably `src/app/AGENTS.md`).
- Add repo-local docs:
  - `.codex/skills/README.md`
  - `.codex/prompts/README.md`

## Testing / Verification

- `rg` search confirms no mentions of `DeepWiki` or `Next DevTools` remain in `AGENTS.md` files.
- Quick markdown sanity check by opening the updated docs and confirming headings render logically.

## Rollout

- Documentation-only change; no runtime rollout.
