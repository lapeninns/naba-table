---
task: agents-policy-refresh
timestamp_utc: 2026-02-06T13:43:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create task folder + required files

## Policy Updates

- [x] Update `/AGENTS.md` (non-negotiables + safety guards + MCP catalog + branch naming)
- [x] Update nested `AGENTS.md` frontmatter to agents_version 5.4
- [x] Update `src/app/AGENTS.md` MCP usage section (remove Next DevTools)

## Skills/Prompts

- [x] Add `.codex/skills/README.md`
- [x] Add `.codex/prompts/README.md`

## Verification

- [x] `rg` confirms no `DeepWiki` references remain in agent policies
- [x] `rg` confirms no `Next DevTools` references remain in agent policies
