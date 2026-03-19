---
task: merge-main-ops-dashboard-sync-conflicts
timestamp_utc: 2026-03-19T16:32:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Merge main into ops dashboard sync maintainability branch

## Objective

We will integrate `main` into `codex/ops-dashboard-sync-maintainability-20260319-1555` so that the branch can land without conflicts while preserving the branch's ops dashboard maintainability improvements and any safe upstream fixes from `main`.

## Success Criteria

- [ ] `main` merges cleanly into the branch.
- [ ] All conflict markers are resolved with a single canonical implementation per codepath.
- [ ] Focused verification passes for touched backend/dashboard areas.
- [ ] A conventional commit records the merge resolution.

## Architecture & Components

- Git merge on current branch: surface exact conflicts.
- Conflict review targets:
  - `lib/**` shared helpers
  - `server/**` ops services
  - `src/app/**` route handlers and dashboard pages
  - `src/components/features/dashboard/**`
  - `src/hooks/ops/**`
  - `src/contexts/**`

## Data Flow & API Contracts

- Preserve existing route and hook contracts unless conflict resolution reveals a newer upstream contract that all callers already follow.
- Keep booking lifecycle mutations and dashboard state orchestration aligned with current shared helpers.

## UI/UX States

- No intentional UI redesign.
- Preserve existing dashboard loading, empty, error, and success states.

## Edge Cases

- Concurrent refactor extractions vs upstream bug fixes in the same file.
- Route handler conflict markers where validation/error shapes differ.
- Task artifact additions from both sides of the merge.

## Testing Strategy

- Run targeted tests for ops dashboard/session/realtime areas touched by the merge.
- If user-facing dashboard files materially change, record limited-scope UI verification and note whether Chrome DevTools MCP is required by the final diff.

## Rollout

- No rollout change; merge-only integration.

## DB Change Plan (if applicable)

- None.
