---
task: slot-logic-production-rollout
timestamp_utc: 2026-03-23T13:45:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Research: Slot Logic Production Rollout

## Requirements

- Functional:
  - Push the config-driven slot logic changes already merged on `main`.
  - Apply the matching production data updates so production no longer uses built-in occasion time windows for `lunch` and `dinner`.
  - Set The Old Crown Girton to `30` minute reservation intervals in production.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No UI changes in this rollout.
  - Production writes must use the confirmed production Supabase project only.
  - Keep secrets out of task artifacts and commit history.

## Existing Patterns & Reuse

- Canonical repo-side data updates live in `supabase/migrations/`.
- The merged app logic already expects service periods and operating hours to be the primary timing source:
  - `server/restaurants/schedule.ts`
  - `server/bookings/timeValidation.ts`
  - `reserve/shared/schedule/availability.ts`
- Existing production env files point at the same production Supabase project.

## External Resources

- None.

## Constraints & Risks

- Supabase CLI and `psql` are unavailable in this workspace, so production apply must use equivalent direct SQL/data tooling.
- Production was still on:
  - Old Crown `reservation_interval_minutes = 15`
  - built-in `lunch` availability `11:30-15:30`
  - built-in `dinner` availability `16:00-23:00`
- This rollout changes timing behavior for any restaurant that still depends on built-in occasion windows instead of explicit service periods.

## Open Questions (owner, due)

- Q: Should every restaurant using built-in lunch/dinner now rely entirely on service periods for timing?
  A: Yes for this rollout; that is the canonical logic already merged in code.

## Recommended Direction (with rationale)

- Add a canonical migration for The Old Crown Girton interval override so future environments stay aligned.
- Apply the two production data updates together:
  - clear built-in `lunch`/`dinner` occasion availability
  - set Old Crown interval to `30`
- Capture before/after production snapshots in task artifacts and update the migration log once verified.
