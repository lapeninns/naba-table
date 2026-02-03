# Continuity Ledger

Last updated: 2026-02-03T18:14:05Z

## Goal (incl. success criteria)

- Add per-day reservation interval overrides and fixed slot times (weekly + date-specific).
- Success: Friday/Saturday use slots 16:00/18:00/20:00 while open hours are 15:00–22:00; other days use defaults.
- Success: Schedule API and Ops timeline reflect fixed slots and interval fallback.

## Constraints/Assumptions

- Supabase remote-only; migrations via MCP with staging-first and log in docs.
- Chrome DevTools MCP manual QA required for UI changes.
- Shared min/max interval constants (1–180) used across server/API/UI.
- Fixed slots override interval when present; still respect service periods.

## Key decisions

- Store per-day fixed slots on `restaurant_operating_hours` and use them if set; otherwise use interval.
- Effective interval resolves as override → weekly → restaurant default → 15.

## State

- Core code changes implemented; migration and verification pending.

## Done

- Added shared interval constants and wired profile validation to them.
- Added migration file for operating-hours interval + slot times and logged in `docs/DATABASE_MIGRATIONS.md`.
- Updated operating-hours server/API types and validation for interval + slot times.
- Updated schedule computation to use fixed slots and effective interval.
- Updated Ops Operating Hours UI and Ops floor plan timeline to support fixed slots.

## Now

- Review for any remaining type/api updates and summarize changes.

## Next

- Run tests/QA and capture Chrome DevTools MCP artifacts.
- Apply Supabase migration via MCP (staging-first) and record diff in `tasks/.../artifacts/db-diff.txt`.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- /Users/amankumarshrestha/.codex/worktrees/18cb/SajiloReserveX/server/restaurants/operatingHours.ts
- /Users/amankumarshrestha/.codex/worktrees/18cb/SajiloReserveX/server/restaurants/schedule.ts
- /Users/amankumarshrestha/.codex/worktrees/18cb/SajiloReserveX/src/app/api/ops/restaurants/[id]/hours/route.ts
- /Users/amankumarshrestha/.codex/worktrees/18cb/SajiloReserveX/src/components/features/restaurant-settings/OperatingHoursSection.tsx
- /Users/amankumarshrestha/.codex/worktrees/18cb/SajiloReserveX/src/components/features/seating/FloorPlanPage.tsx
- /Users/amankumarshrestha/.codex/worktrees/18cb/SajiloReserveX/supabase/migrations/20260203_add_operating_hours_reservation_slots.sql
- /Users/amankumarshrestha/.codex/worktrees/18cb/SajiloReserveX/docs/DATABASE_MIGRATIONS.md
