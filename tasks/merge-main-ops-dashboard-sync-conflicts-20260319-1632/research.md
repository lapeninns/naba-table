---
task: merge-main-ops-dashboard-sync-conflicts
timestamp_utc: 2026-03-19T16:32:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Merge main into ops dashboard sync maintainability branch

## Requirements

- Functional:
  - Merge `main` into `codex/ops-dashboard-sync-maintainability-20260319-1555`.
  - Resolve all conflicts without regressing the branch's ops dashboard maintainability work.
  - Leave the branch in a commit-ready clean state.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve current route/auth boundary validation behavior.
  - Preserve existing dashboard accessibility and user-visible behavior unless a conflict requires a safe adjustment.
  - Keep changes focused to conflict resolution only.

## Existing Patterns & Reuse

- Current branch already contains task-artifact precedents for focused refactors and fixes on 2026-03-19.
- Dashboard domain logic is split across `server/ops`, `src/app/api/ops`, `src/components/features/dashboard`, `src/hooks/ops`, and `src/contexts/ops-session.tsx`.
- Shared session and realtime invalidation helpers already exist in the branch diff and should remain canonical if they are part of the newer maintainability path.

## External Resources

- None required for the merge itself; use local source of truth and existing repo patterns.

## Constraints & Risks

- Conflict resolution must honor root and closest `AGENTS.md` rules for app routes, components, hooks, contexts, shared lib, and backend services.
- UI changes would require Chrome DevTools MCP verification; if conflicts only preserve an existing internal refactor with no user-visible changes, focused tests may be sufficient to document limited verification scope.
- The branch and `main` each have one commit beyond the merge base, so conflicts may reflect overlapping edits rather than broad divergence.

## Open Questions (owner, due)

- Q: Which side contains the newer canonical implementation for overlapping ops dashboard state and lifecycle handling?
  A: Determine during conflict inspection using the merge base and local file history. Owner: github:@amanshresthaa. Due: 2026-03-19.

## Recommended Direction (with rationale)

- Perform a standard merge of `main` into the current branch, inspect each conflict in context, and prefer the most maintainable canonical codepath while preserving branch-intended refactors and safe `main` fixes. This keeps history accurate and minimizes accidental behavior changes.
