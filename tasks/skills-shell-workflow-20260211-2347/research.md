---
task: skills-shell-workflow
timestamp_utc: 2026-02-11T23:47:11Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: OpenAI skills + shell tips policy adoption

## Requirements

- Functional:
  - Explain the OpenAI article and extract concrete recommended practices.
  - Evaluate each recommendation for fit with this repository's workflow.
  - Update root `AGENTS.md` to incorporate adopted practices.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Documentation-only change; must not relax non-overridable security and quality rules.

## Existing Patterns & Reuse

- `AGENTS.md` already has SDLC, task artifacts, MCP usage, multi-agent rules, and continuity ledger guidance.
- `tasks/*` already enforce `research.md`, `plan.md`, `todo.md`, and `verification.md` for each change.

## External Resources

- [How to use Codex with skills, shell commands, and compaction](https://developers.openai.com/blog/skills-shell-tips) — source of practical recommendations for prompt structure, shell robustness, and reusable skills.

## Recommended Practices from Article + Fit

1. Create reusable skills for recurring workflows.
   - Fit: Yes.
   - Reason: Matches existing `~/.codex/skills` and project preference for repeatable SDLC flows.
2. Front-load context and success criteria before implementation.
   - Fit: Yes.
   - Reason: Aligns with Phase 1/2 requirements and reduces rework.
3. Ask for/check a TODO checklist before edits.
   - Fit: Yes.
   - Reason: Already present via `todo.md`; adopting explicitly in execution prompts improves consistency.
4. Use robust shell defaults (`set -euo pipefail`) for multi-step scripts.
   - Fit: Yes.
   - Reason: Improves fail-fast behavior and prevents silent errors.
5. Prefer safe iteration patterns for filenames/output (`while IFS= read -r`), avoid brittle substitutions.
   - Fit: Yes.
   - Reason: Prevents path parsing bugs and flaky automation.
6. Include explicit verification instructions in prompt/workflow.
   - Fit: Yes.
   - Reason: Already required; this codifies minimum checks for doc and code changes.
7. Use tmux for long-running/parallel command orchestration.
   - Fit: Partial.
   - Reason: Useful for human local workflows; not always available or needed in constrained agent sessions.
8. Pre-seed likely debugging branches/next actions in instructions.
   - Fit: Yes.
   - Reason: Improves recovery speed and keeps context compact.
9. Escalate reasoning effort when blocked, then persist findings in artifacts.
   - Fit: Yes.
   - Reason: Consistent with continuity ledger and task artifact discipline.
10. Treat context compaction as normal: store durable state in files, not chat memory.

- Fit: Yes.
- Reason: Already a core policy (`CONTINUITY.md`); article validates this approach.

## Constraints & Risks

- Avoid introducing tool-specific behavior that conflicts with root non-overridable rules.
- Keep changes focused to policy updates; no unrelated refactors.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Add a dedicated section in `AGENTS.md` under tooling/workflow describing adopted skills+shell practices.
- Add a short quick-reference checklist for enforceability during daily execution.
- Keep tmux guidance optional (recommended where available) to avoid hard dependency.
