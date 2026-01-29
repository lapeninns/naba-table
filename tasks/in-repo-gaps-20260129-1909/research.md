---
task: in-repo-gaps-20260129-1909
timestamp_utc: 2026-01-29T19:09:00Z
owner: github:@droid
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Research: Fix In-Repo Readiness Gaps

## Requirements

**Functional:**

- Add `.devcontainer/devcontainer.json` for consistent dev environments
- Document test isolation policy
- Create single-command setup script
- Add documentation freshness policy/automation
- Create `.codex/skills/` directory structure

**Non-functional:**

- Follow AGENTS.md conventions
- Keep changes minimal and focused
- No breaking changes to existing tooling

## Existing Patterns & Reuse

- `.github/` for tooling configs (CODEOWNERS, templates, workflows)
- `scripts/` for automation scripts
- `docs/` for documentation
- `package.json` scripts for common tasks

## External Resources

- [VS Code devcontainer schema](https://containers.dev/implementors/json_reference/) — devcontainer.json reference
- [Vitest isolation docs](https://vitest.dev/guide/test-context.html) — test isolation patterns

## Constraints & Risks

- devcontainer requires Docker but should be optional (not blocking dev)
- Test isolation docs must align with existing Vitest config
- Setup script must handle existing env files gracefully

## Open Questions (owner, due)

- None

## Recommended Direction (with rationale)

1. **Devcontainer**: Add minimal Node.js devcontainer with pnpm, supports VS Code integration
2. **Test isolation**: Document in `docs/testing.md` referencing Vitest pooling + isolation
3. **Setup script**: Create `scripts/setup.sh` chaining install/env/validate/dev
4. **Doc freshness**: Add `.github/workflows/doc-freshness.yml` to check last-updated dates
5. **Skills**: Add placeholder `.codex/skills/README.md` explaining skill structure
