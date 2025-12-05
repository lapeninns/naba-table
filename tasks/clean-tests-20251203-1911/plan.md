---
task: clean-tests
timestamp_utc: 2025-12-03T19:11:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Plan: Remove Tests From Repo

## Objective

Eliminate all first-party test directories, helper routes, and stored test artifacts while leaving third-party dependencies untouched.

## Success Criteria

- [ ] `find` excluding `node_modules` shows no `__tests__`, `tests`, or `test` directories under first-party code.
- [ ] Test helper API routes under `src/app/api/test/*` removed.
- [ ] Generated test artifacts (e.g., `.next`, coverage/playwright reports if present) cleaned.

## Architecture & Components

- Filesystem operation only; no code architecture changes.
- Scope targets: `server/**/__tests__`, `components/**/__tests__`, `lib/**/__tests__`, `reserve/**/tests|__tests__`, `src/**/__tests__`, `src/app/api/test/*`.

## Data Flow & API Contracts

- N/A — destructive removal of files.

## UI/UX States

- N/A.

## Edge Cases

- Preserve `node_modules` and other vendor assets.
- If `.next` exists, safe to delete entire directory (build artifact) to remove embedded `test` folder.
- Ensure no accidental removal of non-test routes with similar names (validate targets before deletion).

## Testing Strategy

- Post-deletion validation via `find` excluding vendor directories.
- No automated tests to run (they are being removed).

## Rollout

- Immediate apply to working tree; no feature flag.
- If rollback needed, restore via VCS checkout of removed paths.

## DB Change Plan (if applicable)

- Not applicable; no database changes.
