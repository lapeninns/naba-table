---
task: agents-policy-from-codex-sessions
timestamp_utc: 2026-02-06T14:08:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Agent Governance Derived From `~/.codex/sessions`

## Scope

Update repo agent governance (`AGENTS.md`, nested `AGENTS.md`, repo-local `.codex/*` docs) using **only** evidence found in:

- `/Users/amankumarshrestha/.codex/sessions/**/rollout-*.jsonl`

## Data Sources (Evidence Files)

The sessions directory primarily contains JSONL rollouts. Each rollout includes:

- `session_meta.payload.instructions` (project instructions injected for the session)
- `session_meta.payload.base_instructions.text` (base behavior/formatting guidance)
- message items where the user pasted explicit instruction blocks (`# AGENTS.md instructions ...`)
- tool-related troubleshooting notes for MCP servers (e.g. Augment Context Engine, DeepWiki)

## Key Findings (High Signal)

### Global + Project instruction blocks exist and are repeated

- A SajiloReserveX-specific instruction block exists and repeats across many sessions:
  - Non-negotiables: production-grade, canonical codepath, direct integrations, single source of truth, fail-fast invariants
  - Skills/prompts locations and fallback behavior
  - Coding style constraints (LOC / nesting)
  - Security guards (no delete/move/overwrite without explicit request; prefer `trash`)
  - Git + PR policies (`gh`, ask before push, Conventional Commits, PR format)
  - Shell discipline (prefer built-ins when available; `fd`/`rg`/`ast-grep`/`jq`/`yq`)

### MCP availability drifts over time; DeepWiki was removed in practice

- Sessions include explicit work to install and use Augment Context Engine (`auggie`) and remove DeepWiki from MCP configs.
- Sessions include notes that some MCP servers (Supabase MCP, DeepWiki, Context7) were not available in some environments.

### Skills usage rules are explicitly defined in sessions

- Sessions include a canonical description of:
  - skill trigger rules (skill name mention or description match)
  - progressive disclosure usage
  - "description as trigger" guidance

## Risks / Constraints

- Sessions may include sensitive payloads; do not copy raw session content into the repo.
- When encoding policy into `AGENTS.md`, prefer paraphrase and short excerpts only.
- Resolve conflicts by choosing the **most recent** consistent instruction blocks in sessions, unless a session explicitly overrides.
