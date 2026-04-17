# Continuity Ledger

Last updated: 2026-04-17T16:57:00Z

## Goal (incl. success criteria)

- Move the Old School House drinks-only note off the weekly operating-hours rows and onto temporary overrides only.
- Success: weekly rows for `the-old-school-house` have empty notes.
- Success: override rows for `2026-04-17` through `2026-04-23` carry the drinks-only note.
- Success: Friday `2026-04-24` has no temporary note override because food returns that day.

## Constraints/Assumptions

- Follow root `AGENTS.md`.
- This is a production remote Supabase data change.
- No local Supabase path is allowed.
- No code changes are required for the requested behavior.

## Key decisions

- Use production restaurant `a120da71-ba6d-446f-a33a-2e78787abcb0` / `the-old-school-house` as the canonical target.
- Clear all seven weekly `notes` fields.
- Add temporary per-date overrides for `2026-04-17` through `2026-04-23` carrying the drinks-only note and matching the corresponding weekly hours.

## State

- Task folder created at `tasks/old-school-house-override-notes-20260417-1652/`.
- Confirmed current production state before the write:
  - 7 weekly rows existed.
  - each weekly row already had the drinks-only note.
  - no override rows existed.
- Applied the production update and verified after-state:
  - weekly notes are now `null`
  - 7 override rows exist for `2026-04-17` through `2026-04-23`
  - each override row carries the drinks-only note
  - no override was created for `2026-04-24`

## Done

- Created the task artifacts for this production operating-hours change.
- Updated the live production rows for The Old School House.
- Saved before/after proof in the task artifacts.

## Now

- Final pass on task notes and user handoff.

## Next

- Share the exact override window and verification evidence with the user.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/old-school-house-override-notes-20260417-1652/research.md
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/old-school-house-override-notes-20260417-1652/plan.md
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/old-school-house-override-notes-20260417-1652/todo.md
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/old-school-house-override-notes-20260417-1652/verification.md
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/old-school-house-override-notes-20260417-1652/artifacts/before.json
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/old-school-house-override-notes-20260417-1652/artifacts/after.json
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/old-school-house-override-notes-20260417-1652/artifacts/summary.json
