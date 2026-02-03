---
task: seed-restaurant
timestamp_utc: 2026-02-03T13:22:35Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Seed a New Restaurant

## Requirements

- Functional:
- Non-functional (a11y, perf, security, privacy, i18n):

## Existing Patterns & Reuse

- Reuse Supabase service role scripts under `scripts/` and restaurant creation logic in `server/restaurants/create.ts`.

## External Resources

- N/A

## Constraints & Risks

- Supabase is remote-only; do not run local migrations/seeds.
- Validate required restaurant inputs before insert.

## Open Questions (owner, due)

- Q: Which environment should the seed target (staging or production)? (owner: github:@amankumarshrestha, due: 2026-02-03)

## Recommended Direction (with rationale)

- Add a new seed script under `scripts/` that inserts one restaurant using the existing create logic and service role credentials.
