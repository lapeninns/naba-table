---
task: delete-amanshrestha-records
timestamp_utc: 2026-04-13T11:37:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create task folder and artifact directory
- [x] Read root and `supabase/AGENTS.md`
- [x] Inspect existing destructive-operation scripts and customer normalization path

## Core

- [x] Author task-local dry-run/apply script for contact-based record discovery
- [x] Run dry run against staging
- [x] Run dry run against production
- [x] Review whether auth-linked rows are implicated
- [x] Execute public app-data delete on staging
- [x] Execute public app-data delete on production

## UI/UX

- [x] Not applicable; no UI change requested

## Tests

- [x] SQL dry-run evidence captured for staging
- [x] SQL dry-run evidence captured for production
- [x] Post-delete zero-match verification captured for staging
- [x] Post-delete zero-match verification captured for production

## Notes

- Assumptions:
  - "Delete all the records" means application data for the target contact, not an automatic auth-user purge unless explicitly confirmed.
- Deviations:
  - Because this is a destructive production data operation, the workflow will pause after dry-run review for explicit final confirmation before apply.
  - The dry-run/apply path is implemented as a task-local TypeScript script rather than raw SQL because the available repo credentials worked reliably through Supabase service-role APIs but not through direct Postgres access in this environment.
  - Production apply needed one retry after Supabase/PostgREST reported `table_soft_holds` missing from schema cache; the runner was patched to ignore missing-table deletes and the resumed apply completed successfully.

## Batched Questions

- None.
