# Continuity Ledger

Last updated: 2026-01-25T21:38:20Z

## Goal (incl. success criteria)

- Unblock Vercel production build failing on env validation for `NEXT_PUBLIC_FEATURE_REALTIME_FLOORPLAN`.
- Success: Build passes with required env var set or validation adjusted per plan.

## Constraints/Assumptions

- Follow AGENTS.md SDLC phases; no coding before requirements & plan reviewed.
- Everything is a task with `tasks/<slug>-YYYYMMDD-HHMM>/` artifacts.
- Production deployment context; secrets not committed.

## Key decisions

- Proceed with task setup and SDLC artifacts before code changes.

## State

- Task folder and SDLC stubs created; ready to inspect env validation code.

## Done

- Identified build failure: env validation requires `NEXT_PUBLIC_FEATURE_REALTIME_FLOORPLAN` boolean.
- Created task folder and SDLC artifacts for fix.

## Now

- Inspect env validation implementation to confirm allowed values and defaults.

## Next

- Decide on env-only fix vs code default and implement if needed.

## Open questions (UNCONFIRMED if needed)

- Should we set the env var in Vercel only, or adjust validation to allow a default? (UNCONFIRMED)

## Working set (files/ids/commands)

- scripts/validate-env.ts
- tasks/fix-realtime-floorplan-env-20260125-1306/research.md
- tasks/fix-realtime-floorplan-env-20260125-1306/plan.md
- tasks/fix-realtime-floorplan-env-20260125-1306/todo.md
- tasks/fix-realtime-floorplan-env-20260125-1306/verification.md
