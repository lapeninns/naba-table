---
task: agents-policy-from-codex-sessions
timestamp_utc: 2026-02-06T14:08:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Agent Governance Derived From `~/.codex/sessions`

## Objective

Ensure this repo’s agent governance matches what has actually been enforced historically across Codex sessions, without importing new policy from outside the sessions corpus.

## Success Criteria

- [ ] `AGENTS.md` includes all stable requirements found in sessions:
  - non-negotiables, security, git/PR rules, style constraints, skills/prompts conventions, MCP usage/fallback.
- [ ] MCP/tool catalog matches observed session configuration/availability (not just aspirational).
- [ ] A Q&A checklist exists that documents:
  - which questions define governance,
  - where in sessions each answer was sourced from.

## Steps

1. Build a governance Q&A checklist (`tasks/.../qa.md`).
2. For each question, extract answers by searching `~/.codex/sessions` rollouts and recording source file paths.
3. Update `/AGENTS.md` and nested `AGENTS.md` files to match the derived answers.
4. Verify by searching `~/.codex/sessions` that every policy addition maps to at least one source.

## Verification

- `rg` searches on the sessions corpus confirm policy items are grounded in session evidence.
- `rg` on the repo confirms `AGENTS.md` reflects those policies consistently.
