---
task: grant-railway-access
timestamp_utc: 2026-02-03T13:59:56Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Grant Railway Pub Access

## Requirements

- Functional:
  - Grant therailway@lapeninns.com access to The Railway Pub in production.
  - Role must be set explicitly.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No UI changes.
  - Use service role credentials only; avoid logging secrets.

## Existing Patterns & Reuse

- Supabase service-role scripts under `scripts/`.
- `restaurant_memberships` table in `types/supabase.ts`.

## External Resources

- N/A

## Constraints & Risks

- Supabase is remote-only.
- Auth lookup may require admin API access; avoid DB credentials when not needed.

## Open Questions (owner, due)

- Q: Confirm desired role (owner/admin/staff/viewer). (owner: github:@amankumarshrestha, due: 2026-02-03)

## Recommended Direction (with rationale)

- Add a small script to resolve user id by email, then insert/update `restaurant_memberships` for the target restaurant.
