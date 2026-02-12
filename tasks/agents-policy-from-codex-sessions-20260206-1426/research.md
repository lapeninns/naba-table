---
task: agents-policy-from-codex-sessions
timestamp_utc: 2026-02-06T14:26:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Sessions-Only Governance Refresh

## Scope

Reconcile repo governance docs (`AGENTS.md`, `.codex/skills/README.md`) using **only** evidence from `~/.codex/sessions/**/rollout-*.jsonl`. No external policy sources.

## Data Sources (6 Rollout Files)

| Ref | File                                                      | Key Line | Content Summary                                                                                                                                                                                           |
| --- | --------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | `~/.codex/sessions/2026/01/28/rollout-…-019c04a5-….jsonl` | 3        | Full AGENTS.md instruction block: Non-negotiables, Codex behaviour, Skills, Coding Style, Security guards, Git operations, Pull requests, Shell discipline                                                |
| R2  | `~/.codex/sessions/2026/01/30/rollout-…-019c1067-….jsonl` | 3        | Same instruction block (cross-project consistency confirmation)                                                                                                                                           |
| R3  | `~/.codex/sessions/2026/02/06/rollout-…-019c3308-….jsonl` | 4        | Full AGENTS.md + project-doc snapshot including MCP catalog (Chrome DevTools, Shadcn, Next DevTools, Supabase, Context7, DeepWiki), Skills list, trigger rules, progressive disclosure, fallback behavior |
| R4  | `~/.codex/sessions/2026/01/27/rollout-…-019bfed1-….jsonl` | 3        | "Prefer built-in tools" shell discipline block                                                                                                                                                            |
| R5  | `~/.codex/sessions/2025/12/25/rollout-…-019b5620-….jsonl` | 1        | session_meta with "Trigger rules" and "Description as trigger" skills rules                                                                                                                               |
| R6  | `~/.codex/sessions/2026/02/06/rollout-…-019c332d-….jsonl` | 4        | DeepWiki referenced in MCP catalog in project-doc                                                                                                                                                         |

## Key Findings

### 1. Instruction blocks are stable and consistent across sessions

The AGENTS.md instruction block (Non-negotiables through Shell discipline) appears identically in R1:3, R2:3, and R3:4. This confirms the policy is stable, not drifting.

### 2. MCP catalog includes DeepWiki as optional

R3:4 and R6:4 both list DeepWiki in the MCP catalog within the project-doc snapshot. No evidence of removal or unavailability was found in the 6 key rollout files; however, it is listed alongside "if configured" qualifiers. Conclusion: keep DeepWiki as **optional/when configured**.

### 3. Skills rules are explicitly defined

R5:1 contains "Trigger rules" and "Description as trigger" guidance. R3:4 contains progressive disclosure and fallback behavior rules. These are already reflected in `.codex/skills/README.md` but should be strengthened with evidence anchors.

### 4. No evidence for Augment Context Engine in these 6 rollouts

The 6 key rollouts do not reference Augment Context Engine. It may appear in other sessions but is out of scope for this refresh.

## Constraints

- No raw session payloads in repo files; paraphrases + file:line pointers only.
- No application code edits.
- No `git push`.
