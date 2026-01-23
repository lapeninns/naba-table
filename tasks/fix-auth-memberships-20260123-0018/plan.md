---
task: fix-auth-memberships
timestamp_utc: 2026-01-23T00:18:11Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Fix memberships load + Supabase auth warning

## Objective

We will enable app pages to load memberships without permission errors and ensure authenticated user data is fetched securely.

## Success Criteria

- [ ] No "permission denied for schema public" during app layout memberships load.
- [ ] Auth warning about `getSession()` user object no longer appears.

## Architecture & Components

- `src/app/app/(app)/layout.tsx` (OpsAppLayout):
  - Use `getServerComponentSupabaseClient()` for auth `getUser()`.
  - Fetch memberships via `fetchUserMemberships(userId)` (service-role default).
  - Avoid server `getSession()`; allow client to resolve session on mount.
- `server/team/access.ts`: reuse existing `fetchUserMemberships` behavior (service-role default).
- `hooks/useSupabaseSession.tsx`: no change unless UX requires server session hydration.

## Data Flow & API Contracts

- Server layout → Supabase Auth (`getUser()`).
- Server layout → DB (`restaurant_memberships` + `restaurants` join) via service-role client.

## UI/UX States

- Loading / Empty / Error / Success

## Edge Cases

- Authenticated user with zero memberships → empty memberships array.
- Service-role key missing/misconfigured → fail early with clear error.

## Testing Strategy

- Manual dev verification: load `/app/dashboard` without schema permission error in server logs.
- Confirm no `getSession()` warning in server logs after changes.
- No UI changes expected (DevTools MCP not required unless UI touched).

## Rollout

- Feature flag: <TBD or N/A>

## DB Change Plan (if applicable)

- Target envs: staging → production (window: to be scheduled)
- Backup reference: <snapshot/PITR link>
- Dry-run evidence: `artifacts/db-diff.txt`
- Change: restore privileges for `service_role` on `public` schema (USAGE; EXECUTE on functions; SELECT on `restaurant_memberships` if needed).
- Rollback plan: revoke privileges granted in the migration.
