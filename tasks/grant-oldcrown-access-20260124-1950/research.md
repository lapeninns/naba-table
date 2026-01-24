---
task: grant-oldcrown-access
timestamp_utc: 2026-01-24T19:50:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Grant Old Crown access

## Requirements

- Functional: Grant `oldcrown@lapeninns.com` access to the Old Crown restaurant in nabatable-pre-staging with top role.
- Non-functional: Use Supabase MCP/remote only; no secrets in artifacts.

## Existing Patterns & Reuse

- Access is represented via `restaurant_memberships` (see server/auth guards).

## External Resources

- None.

## Constraints & Risks

- Must target nabatable-pre-staging project ref `loxrwkeuxesctnrdpksy`.
- Role must be valid for `restaurant_memberships.role`.

## Open Questions (owner, due)

- Q: Which exact restaurant record represents “Old Crown” (name/slug)?
  A: Will query by name in pre-staging.

## Recommended Direction (with rationale)

- Use Supabase MCP to look up restaurant and user, then insert membership with highest role available.
