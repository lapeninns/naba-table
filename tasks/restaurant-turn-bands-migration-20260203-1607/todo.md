---
task: restaurant-turn-bands-migration
timestamp_utc: 2026-02-03T16:07:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Pull Vercel envs for production/preview to source DB passwords.
- [x] Identify staging/production project refs from Vercel envs.
- [ ] Resolve staging migration history drift before applying.

## Core

- [ ] Run `supabase db push --db-url ... --dry-run` and save output.
- [ ] Apply `supabase db push --db-url ... --yes` if pending.

## Tests

- [ ] Re-run dry-run to confirm no pending migrations.

## Notes

- Assumptions:
- Deviations:
  - Used direct `supabase db push` instead of `pnpm db:push` to avoid leaking secrets in `pnpm` script echo.
  - Staging push blocked by remote migration history drift (missing `20260126125806` locally).

## Batched Questions

- ...
