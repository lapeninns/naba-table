---
task: seed-railway-from-cornerhouse
timestamp_utc: 2026-02-03T13:27:20Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Research: Copy Cornerhouse Data to New Restaurant Seed

## Requirements

- Functional:
  - Copy Corner House restaurant config into a new restaurant named "The Railway Pub".
  - Source slug: `the-corner-house-pub-cambridge`.
  - Target environment: production (direct).
  - Scope: restaurant config only (restaurants, service periods, tables, zones, policies).
- Non-functional (a11y, perf, security, privacy, i18n):
  - No UI changes.
  - Avoid copying PII; config-only data.

## Existing Patterns & Reuse

- Supabase service-role scripts under `scripts/` for remote operations.
- `server/restaurants/create.ts` for validated restaurant creation.
- `types/supabase.ts` for table column references.

## External Resources

- N/A

## Constraints & Risks

- Supabase is remote-only; no local DB operations.
- Production data access requires explicit scope and guardrails.
- Data ownership and tenant boundaries must be respected.
- Auth user creation for new owner must avoid storing secrets in code.

## Open Questions (owner, due)

- Q: Confirm the exact table list for "policies" (e.g., allowed_capacities, restaurant_capacity_rules, restaurant_operating_hours). (owner: github:@amankumarshrestha, due: 2026-02-03)

## Recommended Direction (with rationale)

- Define a scoped, explicit table list and perform a tenant-scoped copy using service role access to avoid accidental cross-tenant leakage.
- Use a dry-run mode to report row counts before applying in production.
