---
task: multi-agent-revamp
timestamp_utc: 2026-01-21T23:38:29Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Multi-Agent Collaboration Revamp

## Requirements

- Functional:
  - Update `/AGENTS.md` to document multi-agent collaboration workflows and policies.
  - Update/extend `skills/` to include multi-agent coordination guidance.
  - Update `skills/mcp-integration.md` to clarify MCP vs. multi-agent tooling and parallelization rules.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Documentation-only change; must preserve existing security constraints (secrets, Supabase remote-only, a11y).

## Existing Patterns & Reuse

- Root `/AGENTS.md` already defines SDLC phases, MCP usage, and skills references.
- `skills/agent-skills-ecosystem.md` defines skills architecture and templates.
- `skills/mcp-integration.md` defines MCP catalog and workflows.
- `skills/continuity-ledger.md` governs session state.

## External Resources

- None required (internal policy update).

## Constraints & Risks

- Must follow SDLC phases; no edits before requirements and plan are reviewed.
- Root non-overridable rules remain unchanged (security, Supabase remote-only, a11y, Shadcn, Chrome DevTools MCP).
- Keep scope focused to multi-agent collaboration guidance; avoid unrelated refactors.

## Open Questions (owner, due)

- Confirm owner/reviewer handles for task metadata. (owner: github:@maintainers, due: 2026-01-22)
  A: github:@maintainers confirmed.
- Desired level of prescriptiveness for multi-agent workflows (strict vs. flexible). (owner: github:@maintainers, due: 2026-01-22)
  A: Provide guidance and checklists; avoid overly rigid gating beyond non-negotiables.
- Should we add a dedicated new skill file (e.g., `skills/multi-agent-collaboration.md`) or update existing skills only? (owner: github:@maintainers, due: 2026-01-22)
  A: Dedicated skill file approved.

## Recommended Direction (with rationale)

- Add a focused multi-agent collaboration section in `/AGENTS.md` and a dedicated skill file to keep orchestration detail out of the main policy doc. (Confirmed)
- Update `skills/mcp-integration.md` to clarify MCP vs. multi-agent tooling and safe parallelization patterns.
- Keep edits minimal and aligned with existing structure to preserve policy enforcement.
