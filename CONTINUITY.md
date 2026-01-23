# Continuity Ledger

Last updated: 2026-01-23T07:55:42Z

## Goal (incl. success criteria)

- Remove “Drinks & Cocktails” as a booking occasion and restrict bookings to lunch/dinner only within service periods.
- Success: Schedule returns slots only within lunch/dinner service periods; weekday 15:00–17:00 slots are absent; no fallback when lunch/dinner periods missing.

## Constraints/Assumptions

- Follow AGENTS SDLC phases; no coding before requirements and plan are reviewed.
- Task artifacts required under `tasks/<slug>-YYYYMMDD-HHMM>/`.
- Manual UI QA via Chrome DevTools MCP required for UI output changes.
- Supabase remote-only for data changes (staging → prod).

## Key decisions

- Delete “Drinks & Cocktails” from `booking_occasions`.
- Return zero slots when no lunch/dinner service periods exist.
- Enforce service-period coverage in schedule generation (no fallback outside periods).

## State

- Implementation complete; pending manual UI QA and verification.
- User requested production SQL; generated script for deletion.

## Done

- Implemented schedule filtering to only include slots within service periods.
- Deleted drinks bookings (3), drinks service periods (21), and drinks occasion in prior run.
- Generated production SQL script in task artifacts.

## Now

- Await user running SQL on production or switching MCP to production.

## Next

- Run Chrome DevTools MCP manual QA and update `verification.md`.

## Open questions (UNCONFIRMED if needed)

- Which command/URL should be used for DevTools QA?

## Working set (files/ids/commands)

- server/restaurants/schedule.ts
- tasks/disable-weekday-gap-20260123-0054/artifacts/remove-drinks-production.sql
- tasks/disable-weekday-gap-20260123-0054/verification.md
