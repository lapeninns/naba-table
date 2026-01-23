---
task: grant-oldcrown-access
timestamp_utc: '2026-01-22T23:57:47Z'
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Grant Oldcrown Access

## Requirements

- Functional: grant oldcrown@lapeninns.com access to the Oldcrown restaurant in nabatable-pre-staging.
- Non-functional: use Supabase remote-only access; keep SQL idempotent; do not expose secrets.

## Existing Patterns & Reuse

- Use `public.restaurant_memberships` to map users to restaurants.
- Valid roles: owner/manager/host/server (constraint in schema).

## External Resources

- None.

## Constraints & Risks

- Role for the user is not specified.
- User may not exist in `auth.users` (requires invite or user creation).

## Open Questions (owner, due)

- Q: Which role should be assigned? (owner/manager/host/server)
  A: UNCONFIRMED.

## Recommended Direction (with rationale)

- Use SQL CTEs to look up `auth.users` by email and `restaurants` by slug, then insert into `restaurant_memberships` with a role, guarded by `WHERE NOT EXISTS`.
