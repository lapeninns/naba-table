---
task: agents-policy-refresh
timestamp_utc: 2026-02-06T13:43:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Agent Rules + MCP Alignment

## Requirements

- Consolidate and align agent guidance based on this session:
  - Update `AGENTS.md` and nested `AGENTS.md` files to reflect current rules.
  - Update MCP/tool references so they match what is actually available in this environment.
  - Capture "skills/prompts" discovery + fallback behavior explicitly.
- Non-functional:
  - No new secrets in repo.
  - Avoid introducing requirements that cannot be met with current tooling.

## Existing Patterns & Reuse

- Root agent policy already exists at `/AGENTS.md` (agents_version 5.4).
- Multiple nested `AGENTS.md` files exist under major directories (agents_version 5.3).
- Root policy references MCP tools that are not available in this environment:
  - `DeepWiki` and `Next DevTools` are referenced but not present in the current toolchain.
- Nested `src/app/AGENTS.md` also references `Next DevTools MCP`.
- Repo currently has no `.codex/` directory for repo-local skills/prompts.

## External Resources

- None required for this change (policy refresh based on session context only).

## Constraints & Risks

- Root `AGENTS.md` path/casing must remain exactly `/AGENTS.md` (CI-sensitive).
- Avoid creating contradictory rules between root and nested policies.
- Keep the MCP catalog accurate to avoid agents "planning" around tools they cannot use.

## Open Questions (owner, due)

- None (policy refresh is self-contained).

## Recommended Direction (with rationale)

- Update root `/AGENTS.md`:
  - Add the session’s missing non-negotiables and safety guards.
  - Replace unavailable MCP references (DeepWiki/Next DevTools) with available tooling.
  - Add explicit guidance for skills/prompts discovery and fallback.
  - Align branch naming with Codex branch prefix constraints.
- Update all nested `AGENTS.md` frontmatter to agents_version 5.4 and refresh dates.
- Update `src/app/AGENTS.md` to remove `Next DevTools MCP` requirement and point to the available tools.
- Add minimal `.codex/skills/` and `.codex/prompts/` readmes so the repo has an explicit home for repo-local skills/prompts.
