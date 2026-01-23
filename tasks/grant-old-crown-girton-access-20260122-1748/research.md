---
task: grant-old-crown-girton-access
timestamp_utc: 2026-01-22T17:48:45Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Grant Old Crown Girton Access (Pre-staging)

## Requirements

- Functional:
  - Grant oldcrown@lapeninns.com membership for the Old Crown Girton restaurant in pre-staging.
  - Ensure the user has access to **only** Old Crown Girton (remove other memberships if any).
- Non-functional:
  - Supabase remote-only operations via MCP or equivalent remote API.
  - No UI changes.

## Existing Patterns & Reuse

- Memberships stored in `public.restaurant_memberships` (see `types/supabase.ts`).
- Roles defined in `lib/owner/auth/roles.ts`.
- Server uses membership checks via `server/team/access.ts`.

## External Resources

- None (internal DB operation).

## Constraints & Risks

- Must target **pre-staging** Supabase project (`loxrwkeuxesctnrdpksy`).
- Removing other memberships could have unintended impact if user needs multiple restaurants.

## Open Questions (owner, due)

- None.

## Findings

- Pre-staging project: `loxrwkeuxesctnrdpksy` (nabatable-pre-staging).
- User `oldcrown@lapeninns.com` exists in `auth.users` with id `b9afc366-0b44-48cc-af91-3a9062df9fd0`.
- Restaurant `The Old Crown Girton` exists with id `a050d1ad-1ee0-4ea0-abc2-22c3778aa52c`.
- User already has membership for Old Crown Girton with role `manager` and no other memberships.

## Recommended Direction (with rationale)

- No DML required; access already satisfies the request.
- Supabase MCP target did not switch in-session; used Supabase Management API to verify pre-staging.
