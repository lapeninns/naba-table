---
task: fix-ops-access
timestamp_utc: 2026-01-24T20:12:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Fix ops access

## Objective

Ensure local ops app can load memberships in pre-staging without schema permission errors.

## Success Criteria

- [ ] Ops layout loads memberships without `42501` errors.
- [ ] `/api/ops/team/memberships` returns memberships.
- [ ] Dashboard no longer shows "No restaurant access yet" for the user.

## Architecture & Components

- Data access path: `src/app/app/(app)/layout.tsx` → `fetchUserMemberships` → Supabase service client.
- Cookie security for local auth: `server/supabase.ts`, `server/security/csrf.ts`, `src/app/api/auth/signout/route.ts`.

## Data Flow & API Contracts

- No contract changes; fix infra/credentials or DB grants.

## Edge Cases

- Service role key is valid but schema grants are missing.

## Testing Strategy

- Manual verification via dev console/network.

## Rollout

- Apply to pre-staging only.

## DB Change Plan (if applicable)

- Target envs: pre-staging only.
- Dry-run evidence: grant checks recorded in `verification.md`.
- Rollback plan: revoke grants if needed.
