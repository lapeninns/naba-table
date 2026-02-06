---
task: agents-policy-from-codex-sessions
timestamp_utc: 2026-02-06T14:26:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Sessions-Only Governance Refresh

## Objective

Reconcile repo governance docs to match what Codex sessions actually enforce, using 6 identified rollout files as the sole evidence corpus.

## Success Criteria

- [ ] `qa.md` documents all governance questions with evidence-backed answers citing the 6 rollout files.
- [ ] Root `AGENTS.md` frontmatter `last_updated` is 2026-02-06.
- [ ] DeepWiki is qualified as "optional / if configured" in the MCP catalog.
- [ ] `.codex/skills/README.md` reflects sessions-backed rules for triggers, progressive disclosure, and fallbacks.
- [ ] `verification.md` contains a reconciliation checklist confirming each item.
- [ ] `artifacts/session-sources.txt` lists the 6 rollout files.
- [ ] No raw session content appears in any repo file.

## Steps

1. **Phase 0**: Create task folder `tasks/agents-policy-from-codex-sessions-20260206-1426/`.
2. **Phase 1**: Populate `research.md` with evidence summary (done in prior thread).
3. **Phase 2-3**: Fill `qa.md` with three sections (AGENTS.md, Skills, MCP) — questions, answers, and file:line anchors.
4. **Phase 4**: Reconcile:
   - Update `AGENTS.md` `last_updated` frontmatter to 2026-02-06 (already done).
   - Ensure DeepWiki qualifier is present (already done at line 778).
   - Update bottom-of-file "Last Updated" text to 2026-02-06.
   - Update `.codex/skills/README.md` with sessions-backed skills rules.
5. **Phase 5**: Fill `verification.md` with reconciliation checklist; create `artifacts/session-sources.txt`.
