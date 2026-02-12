---
task: agents-policy-from-codex-sessions
timestamp_utc: 2026-02-06T14:08:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Governance Q&A (Sessions-Only)

This file enumerates the questions that define agent governance for this repo, plus the answers and the **session files** that contain evidence.

## AGENTS.md Questions

1. What are the non-negotiable engineering quality bars?
2. What SDLC phases and task artifacts are required for any change?
3. What are the security guards (deletion, secrets, validation, auth)?
4. What are the coding style constraints (file size, UI nesting)?
5. What are git rules (commit style, push policy, GitHub tooling)?
6. What should PRs contain (structure, evidence, noise policy)?
7. What shell/search discipline is required (preferred tools)?
8. How should agents behave if files change unexpectedly during work (parallel edits)?

## Skills Questions

1. Where do skills live (repo vs global)?
2. How does an agent decide a skill applies?
3. How should an agent consume a skill (progressive disclosure)?
4. What are the fallback rules if a skill is missing?

## MCP Questions

1. Which MCP servers are referenced in the sessions as part of normal workflow?
2. Which MCP servers are shown as unavailable / removed in practice?
3. What is the fallback when an MCP server is unavailable?

## Answers (Evidence-Backed)

Populate each answer by citing session rollout files under `/Users/amankumarshrestha/.codex/sessions`.

### AGENTS.md Answers

1. Non-negotiable engineering quality bars
   - Production-grade, scalable (>1000 users); avoid MVP/minimal shortcuts.
   - Prefer maintainable, reliable designs (long-term sustainability).
   - Make changes canonical in the primary codepath; remove dead/duplicate paths as part of delivery, but reconcile with the “no delete/move without explicit request” guardrails.
   - Use direct, first-class integrations; avoid wrappers/shims/adapter layers.
   - Single source of truth for business rules/policy (validation, enums, flags, constants, config).
   - Clean API invariants: validate required inputs at boundaries; fail fast.
   - Use latest stable libs/docs; if unsure, do a web search (prefer 2026+ sources when applicable).
   - Evidence:
     - `/Users/amankumarshrestha/.codex/sessions/2026/01/25/rollout-2026-01-25T23-47-55-019bf78e-95bb-7943-9dac-739f412a91e9.jsonl:3`
     - `/Users/amankumarshrestha/.codex/sessions/2026/02/06/rollout-2026-02-06T02-07-56-019c30b4-ba29-7c80-8250-adca384ce1e7.jsonl:3`

2. SDLC phases and task artifacts required
   - Any change is executed as a “Task” with a UTC-stamped task folder.
   - Core artifacts: `research.md`, `plan.md`, `todo.md`, `verification.md`, plus `artifacts/` for evidence.
   - Manual UI QA via Chrome DevTools MCP is mandatory for UI changes; record artifacts (Lighthouse/HAR/traces/screens).
   - Supabase DB work is remote-only and uses staging-first workflows with rollback evidence.
   - Evidence:
     - `/Users/amankumarshrestha/.codex/sessions/2026/01/25/rollout-2026-01-25T23-47-55-019bf78e-95bb-7943-9dac-739f412a91e9.jsonl:3` (embedded “project-doc” AGENTS snapshot)
     - `/Users/amankumarshrestha/.codex/sessions/2026/02/06/rollout-2026-02-06T09-14-30-019c323b-438d-7503-9cc5-e49a4936de37.jsonl:9` (turn context contains SDLC + artifacts + MCP rules)

3. Security guards
   - No delete/move/overwrite without explicit user request; prefer `trash` over `rm` for deletions.
   - Secrets never in source; use env/secret stores; do not log credentials.
   - Validate/sanitize untrusted input (injection, path traversal, SSRF, unsafe uploads).
   - Enforce AuthN/AuthZ and tenant boundaries; least privilege.
   - Be cautious with new dependencies; call out supply-chain/CVE risk.
   - Evidence:
     - `/Users/amankumarshrestha/.codex/sessions/2026/01/25/rollout-2026-01-25T23-47-55-019bf78e-95bb-7943-9dac-739f412a91e9.jsonl:3`

4. Coding style constraints
   - File size discipline: target <=500 LOC (hard cap 750; imports/types excluded).
   - UI/markup nesting discipline: <=3 levels; extract helpers/components when repetition or conditional complexity grows.
   - Evidence:
     - `/Users/amankumarshrestha/.codex/sessions/2026/01/25/rollout-2026-01-25T23-47-55-019bf78e-95bb-7943-9dac-739f412a91e9.jsonl:3`

5. Git rules
   - Use `gh` CLI for GitHub operations (issues/PRs/releases).
   - Ask before any `git push`.
   - Prefer Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, etc.).
   - In Codex desktop context, branch naming is prefixed with `codex/` (branch prefix enforcement).
   - Evidence:
     - `/Users/amankumarshrestha/.codex/sessions/2026/01/25/rollout-2026-01-25T23-47-55-019bf78e-95bb-7943-9dac-739f412a91e9.jsonl:3`
     - `/Users/amankumarshrestha/.codex/sessions/2026/02/06/rollout-2026-02-06T09-14-30-019c323b-438d-7503-9cc5-e49a4936de37.jsonl:9` (developer/app-context includes branch prefix rule)

6. PR contents and noise policy
   - Keep PRs short and structured: “Why” (1–2 bullets), “How” (1–3 bullets), “Tests” (commands run + results).
   - Avoid noise (logs/dumps); include only key context, risks, and screenshots/clips when UX changes.
   - Evidence:
     - `/Users/amankumarshrestha/.codex/sessions/2026/01/25/rollout-2026-01-25T23-47-55-019bf78e-95bb-7943-9dac-739f412a91e9.jsonl:3`

7. Shell/search discipline
   - Prefer deterministic, non-interactive shell commands; limit output (e.g., `head`) and pick a single result consistently.
   - Prefer built-in tools when available (`read_file`, `list_dir`, `grep_files`) before ad-hoc shell plumbing.
   - For shell-based search: `fd` (files), `rg` (text), `ast-grep` (syntax-aware), and `jq`/`yq` for structured extraction/transform.
   - Evidence:
     - `/Users/amankumarshrestha/.codex/sessions/2026/01/25/rollout-2026-01-25T23-47-55-019bf78e-95bb-7943-9dac-739f412a91e9.jsonl:3`

8. Handling unexpected file changes (parallel edits)
   - If files change unexpectedly, assume parallel edits and continue; keep the diff scoped.
   - Stop only for conflicts/breakage, then ask the user for clarification.
   - Evidence:
     - `/Users/amankumarshrestha/.codex/sessions/2026/01/25/rollout-2026-01-25T23-47-55-019bf78e-95bb-7943-9dac-739f412a91e9.jsonl:3`

### Skills Answers

1. Where skills live
   - Skills live in repo `.codex/skills` and global `~/.codex/skills`. If a skill isn’t found locally, load the global one explicitly (plus `references/` and `scripts/` if present).
   - Evidence:
     - `/Users/amankumarshrestha/.codex/sessions/2026/01/25/rollout-2026-01-25T23-47-55-019bf78e-95bb-7943-9dac-739f412a91e9.jsonl:3`

2. How an agent decides a skill applies
   - Trigger rules: if the user names a skill (e.g., `$SkillName`) or the task matches the skill’s description, the skill must be used for that turn.
   - “Description as trigger”: the YAML `description` in `SKILL.md` is a primary signal for applicability.
   - Evidence:
     - `/Users/amankumarshrestha/.codex/sessions/2025/12/23/rollout-2025-12-23T00-17-49-019b4891-bdb4-7d41-9d4b-0252c8b3d277.jsonl:1`
     - `/Users/amankumarshrestha/.codex/sessions/2026/02/06/rollout-2026-02-06T02-07-56-019c30b4-ba29-7c80-8250-adca384ce1e7.jsonl:3`

3. How to consume a skill (progressive disclosure)
   - After deciding to use a skill: open its `SKILL.md` and read only enough to follow the workflow.
   - If referenced, load only the specific `references/` files needed; prefer running/patching `scripts/` over retyping; reuse templates/assets when present.
   - Evidence:
     - `/Users/amankumarshrestha/.codex/sessions/2025/12/23/rollout-2025-12-23T00-17-49-019b4891-bdb4-7d41-9d4b-0252c8b3d277.jsonl:1`

4. Fallback rules if a skill is missing
   - If a named skill isn’t in the list or the path can’t be read: say so briefly and continue with the best fallback approach.
   - Evidence:
     - `/Users/amankumarshrestha/.codex/sessions/2025/12/23/rollout-2025-12-23T00-17-49-019b4891-bdb4-7d41-9d4b-0252c8b3d277.jsonl:1`

### MCP Answers

1. MCP servers referenced as part of normal workflow (sessions evidence)
   - Chrome DevTools MCP (manual UI QA).
   - Shadcn MCP (UI primitives/scaffolding).
   - Supabase MCP (remote-only DB operations).
   - Context7 MCP (library docs/examples).
   - DeepWiki MCP appears in historical configs/docs (remote server).
   - Augment Context Engine (auggie) for codebase retrieval / semantic repo search.
   - Evidence:
     - `/Users/amankumarshrestha/.codex/sessions/2026/01/18/rollout-2026-01-18T17-06-39-019bd212-b135-72c0-a06d-ce8e76a167b1.jsonl:166` (MCP server config includes the list)
     - `/Users/amankumarshrestha/.codex/sessions/2026/01/25/rollout-2026-01-25T23-47-55-019bf78e-95bb-7943-9dac-739f412a91e9.jsonl:3` (embedded AGENTS doc snapshot includes MCP catalog)

2. MCP servers shown as unavailable / removed in practice
   - DeepWiki can be unauthenticated (OAuth not authenticated) and is shown being removed from configs in at least one session (config hygiene task).
   - Evidence:
     - `/Users/amankumarshrestha/.codex/sessions/2026/01/18/rollout-2026-01-18T17-06-39-019bd212-b135-72c0-a06d-ce8e76a167b1.jsonl:535` (DeepWiki not authenticated)
     - `/Users/amankumarshrestha/.codex/sessions/2026/01/18/rollout-2026-01-18T17-06-39-019bd212-b135-72c0-a06d-ce8e76a167b1.jsonl:755` (DeepWiki removed from Codex config)
     - `/Users/amankumarshrestha/.codex/sessions/2026/01/18/rollout-2026-01-18T17-06-39-019bd212-b135-72c0-a06d-ce8e76a167b1.jsonl:782` (summary explicitly states DeepWiki removed from Codex/OpenCode configs)

3. MCP fallback behavior when unavailable
   - If an MCP server is unavailable temporarily: run the equivalent CLI/manual steps and attach artifacts; do not silently skip required verification steps (especially UI QA and DB workflows).
   - Evidence:
     - `/Users/amankumarshrestha/.codex/sessions/2026/01/25/rollout-2026-01-25T23-47-55-019bf78e-95bb-7943-9dac-739f412a91e9.jsonl:3` (embedded AGENTS doc snapshot includes MCP fallback guidance)
