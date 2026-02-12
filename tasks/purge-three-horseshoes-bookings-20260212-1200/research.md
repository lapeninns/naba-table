---
task: purge-three-horseshoes-bookings
timestamp_utc: 2026-02-12T12:00:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Research: Purge all bookings for Three Horseshoes

## Requirement

- Remove all bookings from the Three Horseshoes restaurant (slug expected: `three-horseshoes`).

## Context

- Repo has existing Three Horseshoes setup tasks that use restaurant slug `three-horseshoes`.
- Bookings are stored in `public.bookings` and referenced by multiple operational tables (assignments, state history, holds, analytics, etc).
- Current `.env.local` Supabase project ref appears to be `ndxmivcrehsacuerwxtm` (treat as production unless explicitly stated otherwise).

## Constraints

- Supabase is remote-only for this project.
- Deletion must be scoped to the target restaurant only.
- Default behavior must be safe (dry run); apply must be explicit and guarded.

## Open Questions

- Confirm which Supabase project/environment is intended (staging vs production), via `NEXT_PUBLIC_SUPABASE_URL` and optional `EXPECTED_PROJECT_REF`.
