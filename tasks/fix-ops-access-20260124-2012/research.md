---
task: fix-ops-access
timestamp_utc: 2026-01-24T20:12:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Fix ops "No restaurant access yet"

## Requirements

- Functional: Ops users with restaurant memberships should see access locally (no "No restaurant access yet").
- Non-functional: Supabase remote-only; avoid leaking secrets; minimal change.

## Existing Patterns & Reuse

- Ops layout loads memberships via `fetchUserMemberships` using service role client (`server/team/access.ts`).
- Ops team memberships API uses same `fetchUserMemberships`.

## External Resources

- None.

## Constraints & Risks

- Error seen: `permission denied for schema public` when loading memberships.
- Likely cause: service role key mismatch or missing DB grants.

## Open Questions (owner, due)

- Q: Does `SUPABASE_SERVICE_ROLE_KEY` match pre-staging ref? (To verify)

## Recommended Direction (with rationale)

- Verify service role key ref; if mismatch, update key. If match, grant schema usage/select to service_role in pre-staging.
