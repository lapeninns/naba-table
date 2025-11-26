---
task: zones-migration-seed
timestamp_utc: 2025-11-26T00:15:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Migrations & Seeds for Updated Tables/Zones

## Requirements

- Functional: apply latest migrations and seeds to update tables and zones data.
- Non-functional: remote-only Supabase apply; keep migrations compliant with naming; avoid downtime.

## Existing Patterns & Reuse

- Supabase migrations live in `supabase/migrations/` with timestamped filenames.
- Seeds may be implemented via SQL or `supabase/seed.sql` (to confirm during plan).

## External Resources

- Supabase CLI docs for `db push` and seeding (already used locally).

## Constraints & Risks

- Must not run local Supabase; only remote per policy.
- Archived/rollback files currently skipped due to naming; should avoid interfering with active migration list.

## Open Questions (owner, due)

- Which environment(s) to target beyond current default? (owner: maintainer, due: before production apply)

## Recommended Direction (with rationale)

- Inspect existing migrations and seeds to ensure required updates exist and are correctly ordered.
- Use `supabase db push` to apply pending migration(s) to remote; verify output and log artifacts.
- Run seed command appropriate to project (likely `supabase db reset --seed` is forbidden; prefer `supabase db seed remote --file ...` if configured) — will confirm in plan.
