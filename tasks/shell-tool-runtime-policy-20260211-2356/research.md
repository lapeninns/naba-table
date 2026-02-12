---
task: shell-tool-runtime-policy
timestamp_utc: 2026-02-11T23:56:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Shell tool runtime policy update

## Requirements

- Functional:
  - Compare current root `AGENTS.md` with OpenAI Shell guide + skills/shell article.
  - Add missing shell runtime/security controls to root policy.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Documentation-only change; preserve all non-overridable core rules.

## Existing Patterns & Reuse

- Root policy already has `8.6 Skills + Shell Execution Practices` and compaction guidance.
- Quick-reference checklists are used as enforceable operational gates.

## External Resources

- [Tools: Shell (OpenAI API docs)](https://developers.openai.com/api/docs/guides/tools-shell) — canonical runtime, network, secrets, and hosted/local shell constraints.
- [How to use Codex with skills, shell commands, and compaction](https://developers.openai.com/blog/skills-shell-tips) — execution patterns, compaction strategy, and skill reuse heuristics.

## Gap Assessment

1. Hosted vs local shell selection criteria.
   - Gap: Missing explicit policy.
2. Hosted shell artifact boundary (`/mnt/data`).
   - Gap: Missing explicit policy.
3. Network containment model (`network_policy` and org allowlist subset behavior).
   - Gap: Missing explicit policy.
4. Authenticated outbound calls via `domain_secrets`.
   - Gap: Missing explicit policy.
5. Multi-turn shell continuity (`previous_response_id`, `container_reference`).
   - Gap: Missing explicit policy.
6. Shell call failure handling (`shell_call` / `shell_call_output`, non-zero exits, non-interactive execution).
   - Gap: Missing explicit policy.

## Recommended Direction (with rationale)

- Add `8.7 Shell Tool Runtime & Security Policy` after `8.6` to centralize missing controls.
- Add a dedicated quick-reference checklist block for shell tool runtime to make the rules operational.
- Keep updates scoped and additive; no change to non-overridable core constraints.
