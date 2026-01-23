---
task: nabatable-pre-staging-db-clone
timestamp_utc: 2026-01-22T12:45:16Z
owner: github:@maintainers
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Research: Nabatable pre-staging DB clone

## Requirements

- Functional:
  - Create a new Supabase project named `nabatable-pre-staging`.
  - Copy all production data from `vrdiqfudmwydclqpydee` into the new project.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No secrets in source; use env vars.
  - Supabase remote only.

## Existing Patterns & Reuse

- Use Supabase MCP for project creation and management.

## External Resources

- Supabase management and project APIs (via MCP).

## Constraints & Risks

- Full data copy requires export/import; branches do not copy data.
- Auth users and storage objects may require separate handling.
- Supabase MCP not authenticated in this session; use CLI/API fallback if needed.

## Open Questions (owner, due)

- Q: Should auth users and storage buckets/objects be included?
  A: Yes, copy auth users and storage objects.

## Recommended Direction (with rationale)

- Create new Supabase project, then perform DB dump/restore from production to target.
- Capture steps and evidence in artifacts.
