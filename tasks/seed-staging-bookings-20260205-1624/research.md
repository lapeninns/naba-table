---
task: seed-staging-bookings
timestamp_utc: 2026-02-05T16:24:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Seed 50 Staging Bookings

## Requirements

- Functional:
  - Insert 50 new booking records into staging Supabase.
  - Target restaurant: Old Crown Girton.
  - Single day only: 2026-02-05, dinner window 17:00–21:00 with 15-minute intervals.
  - Multiple bookings per time slot allowed.
  - Tag bookings for cleanup.
  - Use an approved, repeatable path (Supabase CLI or existing seeding script).
  - Respect existing schema constraints and relationships (restaurants, customers, tables).
- Non-functional (a11y, perf, security, privacy, i18n):
  - Remote-only Supabase; never local.
  - No secrets logged; service role key must remain private.

## Existing Patterns & Reuse

- `scripts/generate-bookings-safe.ts` supports `BOOKING_COUNT` and uses Supabase service role key.
- `scripts/execute-sql.ts` runs `generate_bookings.sql` via `SUPABASE_DB_URL` (pg).
- `scripts/check-staging-supabase.ts` validates connectivity.

## External Resources

- Supabase CLI docs (if needed for `supabase db query` or project linking).

## Constraints & Risks

- Must confirm staging project/credentials to avoid touching production.
- Must ensure required fields for `bookings`, `customers`, and `booking_table_assignments` are provided.
- Data should be identifiable as staging seed data for cleanup.

## Open Questions (owner, due)

- Q: Which staging Supabase project ref or URL should be targeted? (owner: github:@amankumarshrestha)
- Q: Confirm DB connection host/URL (db.<project_ref>.supabase.co unresolved). (owner: github:@amankumarshrestha)

## Recommended Direction (with rationale)

- Use `scripts/generate-bookings-safe.ts` with `BOOKING_COUNT=50` to create valid bookings + table assignments using existing schema.
- Validate connectivity with `scripts/check-staging-supabase.ts` before seeding.
