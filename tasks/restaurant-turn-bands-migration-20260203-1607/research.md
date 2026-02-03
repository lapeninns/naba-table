---
task: restaurant-turn-bands-migration
timestamp_utc: 2026-02-03T16:07:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Restaurant Turn Bands Migration

## Requirements

- Functional:
- Non-functional (a11y, perf, security, privacy, i18n):

## Existing Patterns & Reuse

- Supabase migrations under `supabase/migrations/**`.
- `pnpm db:push` uses Supabase CLI; supports `--db-url` and `--dry-run`.

## External Resources

- Supabase CLI `db push` documentation (for `--db-url` usage).

## Constraints & Risks

- Remote-only Supabase; production changes require staging-first and rollback plan.
- Avoid exposing secrets in logs/artifacts.

## Open Questions (owner, due)

- Q: Which production DB URL should be used for `--db-url`? (owner: github:@amanshresthaa, due: 2026-02-03)
- Q: Has the migration been applied to staging already? (owner: github:@amanshresthaa, due: 2026-02-03)

## Recommended Direction (with rationale)

- Use `pnpm db:push -- --db-url ... --dry-run` to confirm pending migrations, then apply with `pnpm db:push -- --db-url ... --yes` if needed. This stays within repo policy and avoids local Supabase.
