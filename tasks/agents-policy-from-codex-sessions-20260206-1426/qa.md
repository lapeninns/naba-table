---
task: agents-policy-from-codex-sessions
timestamp_utc: 2026-02-06T14:26:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Governance Q&A (Sessions-Only Evidence)

All answers are derived exclusively from 6 rollout files (see `artifacts/session-sources.txt`). No raw session payloads are included — only paraphrases and file:line pointers.

---

## AGENTS.md Questions

### Q1. What are the non-negotiable engineering quality bars?

**Answer**: Ship production-grade, scalable (>1000 users) implementations. Optimize for long-term sustainability. Make changes canonical in the primary codepath; delete legacy/dead/duplicate paths. Use direct, first-class integrations (no shims/wrappers). Single source of truth for business rules. Clean API invariants — validate up front, fail fast. Use latest stable libs/docs.

**Evidence**:

- `~/.codex/sessions/2026/01/28/rollout-…-019c04a5-….jsonl:3` (R1) — full instruction block
- `~/.codex/sessions/2026/02/06/rollout-…-019c3308-….jsonl:4` (R3) — same block in project-doc

### Q2. How should agents handle unexpected file changes (parallel edits)?

**Answer**: If files change unexpectedly, assume parallel edits and continue. Keep the diff scoped. Stop only for actual conflicts or breakage, then ask for clarification.

**Evidence**:

- `~/.codex/sessions/2026/01/28/rollout-…-019c04a5-….jsonl:3` (R1) — "If files change unexpectedly, assume parallel edits and continue"

### Q3. Where do skills live and what are the lookup rules?

**Answer**: Skills live in repo `.codex/skills` (local) and `~/.codex/skills` (global). If a `$SkillName` isn't found locally, explicitly load `~/.codex/skills/<skill-name>/SKILL.md` plus any `references/` and `scripts/` it references.

**Evidence**:

- `~/.codex/sessions/2026/01/28/rollout-…-019c04a5-….jsonl:3` (R1)
- `~/.codex/sessions/2026/02/06/rollout-…-019c3308-….jsonl:4` (R3)

### Q4. What are the coding style constraints?

**Answer**: Target <=500 LOC per file (hard cap 750; imports/types excluded). Keep UI/markup nesting <=3 levels; extract components/helpers when repetition, responsibility accumulation, or conditional complexity grows.

**Evidence**:

- `~/.codex/sessions/2026/01/28/rollout-…-019c04a5-….jsonl:3` (R1)
- `~/.codex/sessions/2026/02/06/rollout-…-019c3308-….jsonl:4` (R3)

### Q5. What are the security guards?

**Answer**: No delete/move/overwrite without explicit user request; prefer `trash` over `rm`. Don't expose secrets in code/logs; use env/secret stores. Validate/sanitize untrusted input (injection, path traversal, SSRF, unsafe uploads). Enforce AuthN/AuthZ and tenant boundaries; least privilege. Be cautious with new dependencies; flag supply-chain/CVE risk.

**Evidence**:

- `~/.codex/sessions/2026/01/28/rollout-…-019c04a5-….jsonl:3` (R1)
- `~/.codex/sessions/2026/01/30/rollout-…-019c1067-….jsonl:3` (R2) — confirms cross-project consistency
- `~/.codex/sessions/2026/02/06/rollout-…-019c3308-….jsonl:4` (R3)

### Q6. What are the git operation rules?

**Answer**: Use `gh` CLI for GitHub operations (issues/PRs/releases). Ask before any `git push`. Prefer Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, etc.).

**Evidence**:

- `~/.codex/sessions/2026/01/28/rollout-…-019c04a5-….jsonl:3` (R1)
- `~/.codex/sessions/2026/02/06/rollout-…-019c3308-….jsonl:4` (R3)

### Q7. What should PRs contain?

**Answer**: Keep PRs short and structured: **Why** (1–2 bullets), **How** (1–3 bullets), **Tests** (commands run + results). Avoid noise (logs/dumps); include only key context, risks, and screenshots when UX changes.

**Evidence**:

- `~/.codex/sessions/2026/01/28/rollout-…-019c04a5-….jsonl:3` (R1)
- `~/.codex/sessions/2026/02/06/rollout-…-019c3308-….jsonl:4` (R3)

### Q8. What shell discipline is required?

**Answer**: Prefer built-in tools (e.g., `read_file`/`list_dir`/`grep_files`) over ad-hoc shell plumbing when available. For shell-based search: `fd` (files), `rg` (text), `ast-grep` (syntax-aware), `jq`/`yq` (extract/transform). Keep it deterministic and non-interactive; limit output (e.g., `head`) and pick a single result consistently.

**Evidence**:

- `~/.codex/sessions/2026/01/28/rollout-…-019c04a5-….jsonl:3` (R1)
- `~/.codex/sessions/2026/01/27/rollout-…-019bfed1-….jsonl:3` (R4) — "Prefer built-in tools" block

---

## Skills Questions

### Q9. How does an agent decide a skill applies (trigger rules)?

**Answer**: A skill applies when the user names it (e.g., `$SkillName`) or the task matches the skill's `description` field. The YAML `description` in `SKILL.md` is the primary trigger signal ("description as trigger").

**Evidence**:

- `~/.codex/sessions/2025/12/25/rollout-…-019b5620-….jsonl:1` (R5) — "Trigger rules", "Description as trigger"
- `~/.codex/sessions/2026/02/06/rollout-…-019c3308-….jsonl:4` (R3) — skill trigger rules in project-doc

### Q10. How should an agent consume a skill (progressive disclosure)?

**Answer**: Open the `SKILL.md` and read only enough to follow the workflow. Load only the specific `references/` files needed. Prefer running/patching `scripts/` over retyping. Reuse templates/assets when present. Do not bulk-load unrelated references.

**Evidence**:

- `~/.codex/sessions/2026/02/06/rollout-…-019c3308-….jsonl:4` (R3) — progressive disclosure rules

### Q11. What are the fallback rules when a skill is missing or blocked?

**Answer**: If the named skill isn't available or can't be read, state that briefly and proceed with the best fallback approach. Do not silently skip or fail.

**Evidence**:

- `~/.codex/sessions/2026/02/06/rollout-…-019c3308-….jsonl:4` (R3) — fallback behavior

---

## MCP Questions

### Q12. Which MCP servers are listed in the sessions catalog?

**Answer**: Chrome DevTools, Shadcn, Next DevTools, Supabase, Context7, DeepWiki (if configured).

**Evidence**:

- `~/.codex/sessions/2026/02/06/rollout-…-019c3308-….jsonl:4` (R3) — MCP catalog in project-doc
- `~/.codex/sessions/2026/02/06/rollout-…-019c332d-….jsonl:4` (R6) — DeepWiki in project-doc

### Q13. What is DeepWiki's status?

**Answer**: Listed in session project-doc snapshots as part of the MCP catalog. No evidence of removal or explicit unavailability in the 6 key rollouts. Classified as optional / when configured, based on its qualifier in the project-doc.

**Evidence**:

- `~/.codex/sessions/2026/02/06/rollout-…-019c3308-….jsonl:4` (R3)
- `~/.codex/sessions/2026/02/06/rollout-…-019c332d-….jsonl:4` (R6)

### Q14. What is the MCP unavailable fallback?

**Answer**: If an MCP server is temporarily unavailable, run equivalent CLI/manual steps and attach artifacts. Do not silently skip required verification.

**Evidence**:

- `~/.codex/sessions/2026/02/06/rollout-…-019c3308-….jsonl:4` (R3) — "If MCP unavailable temporarily: run equivalent CLI/manual steps"
