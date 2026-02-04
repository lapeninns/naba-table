# Continuity Ledger

Last updated: 2026-02-04T14:00:00Z

## Goal (incl. success criteria)

- Set default booking buffer to 0 minutes.
- Success: update default venue policy buffers in code after requirements/plan approval.

## Constraints/Assumptions

- Follow root AGENTS policies and any closer AGENTS.md files for touched paths.
- Supabase operations must be remote-only.
- User requested Supabase CLI usage for investigation.

## Key decisions

- None yet.

## State

- Default policy buffers updated to 0 for lunch/dinner.

## Done

- Created task folder `tasks/set-default-buffer-0-20260204-1354` with SDLC stubs.
- Updated `server/capacity/policy.ts` default buffers to 0.

## Now

- Await confirmation to proceed with code change.

## Next

- None.

## Open questions (UNCONFIRMED if needed)

- What exact failure mode is observed in production (UI error, empty table list, API error)?

## Working set (files/ids/commands)

- `tasks/debug-railway-table-assignment-20260204-1213/*`
- `server/capacity/table-assignment/supabase.ts`
- `server/capacity/table-assignment/availability.ts`
- `server/feature-flags.ts`
- `scripts/update-railway-zones-tables.ts`
- `scripts/build-zone-adjacency.ts`
