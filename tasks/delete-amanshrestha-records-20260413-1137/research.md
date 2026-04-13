---
task: delete-amanshrestha-records
timestamp_utc: 2026-04-13T11:37:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Research: Delete Records For Specific Contact

## Requirements

- Functional:
  - Find all remote records associated with `amanshresthaaaaa@gmail.com` and `07467586751`.
  - Run a dry run against staging first and production second before any deletion.
  - Delete the matched records only after the dry run impact is confirmed.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Do not expose secrets in task artifacts or chat.
  - Keep the operation remote-only and environment-specific.
  - Preserve an auditable record of matched rows, dependent rows, and deletion order.

## Existing Patterns & Reuse

- `scripts/purge-restaurant-bookings.ts` already establishes the repo's guarded destructive-operation pattern:
  - dry run by default
  - explicit `--apply` gate
  - expected-project-ref safety check
- `scripts/apply-sql-file.ts` is the canonical multi-statement SQL runner for remote Postgres work.
- `server/customers.ts` defines canonical contact normalization:
  - email => trimmed lowercase
  - phone => UK-aware comparable normalization via `normalizeComparablePhone`

## External Resources

- None required beyond the remote Supabase environments already configured for this repo.

## Constraints & Risks

- This is a high-risk remote data deletion that targets both staging and production.
- Contact data is duplicated across canonical customer rows, denormalized booking rows, and delivery/log tables.
- Some rows may be linked by `customer_id`, some only by `booking_id`, and some only by raw email/phone fields.
- Production deletion should not proceed until dry-run counts are reviewed because the blast radius may span multiple restaurants and historical bookings.

## Open Questions (owner, due)

- Q: Should auth-level rows also be removed if the contact is linked to `auth.users` or auth identities?
  A: Not yet confirmed from schema inspection. Investigate during dry run and pause before apply if auth data is implicated. (owner: github:@maintainers, due: 2026-04-13)

## Recommended Direction (with rationale)

- Use a task-local SQL workflow that:
  - computes canonical normalized email/phone inputs
  - resolves matching customers and bookings
  - counts all dependent rows in staging and production
  - deletes in dependency order only after the dry-run evidence is reviewed
- This keeps the operation reproducible, environment-guarded, and aligned with the repo's existing destructive-operation safety pattern.
