---
task: repo-cleanup
timestamp_utc: 2025-12-26T00:08:11Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Plan: Repo cleanup

## Objective

We will remove agreed-upon unnecessary files/folders, all SQL files, all migration files, pgsql/postgres artifacts, and all past task folders after user approval of a dry-run list.

## Success Criteria

- [ ] Dry-run inventory shared and approved.
- [ ] Approved deletions completed without removing required policy files.
- [ ] Repo tree contains only the new task folder under `tasks/`.

## Architecture & Components

- No code changes; file system cleanup only.

## Data Flow & API Contracts

- N/A

## UI/UX States

- N/A

## Edge Cases

- Hidden/generated folders (e.g., `.next`, `.vercel`) may exist and should be listed if present.
- SQL files inside task artifacts and other directories should be included.

## Testing Strategy

- None (file operations only). Provide a summary of deletions performed.

## Rollout

- Single-step delete after approval; no partial deletes.

## DB Change Plan (if applicable)

- Not applicable (removing local files only; no remote DB changes).
