---
task: fix-ops-logout-session
timestamp_utc: 2026-01-01T11:35:15Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Fix ops logout session persistence

## Objective

We will ensure ops logout clears both server auth cookies and client session state so the user is not immediately re-authenticated.

## Success Criteria

- [ ] Ops logout clears server-side cookies and client auth state.
- [ ] After logout, refreshing does not restore the prior ops session.

## Architecture & Components

- `src/components/features/ops-shell/OpsSidebarLayout.tsx`: update logout handler.
- `lib/supabase/signOut.ts`: optionally extend to support server signout reuse.
- `/api/auth/signout`: existing server endpoint for cookie clearing.

## Data Flow & API Contracts

- Client calls POST `/api/auth/signout` (credentials included) before client `supabase.auth.signOut()`.

## UI/UX States

- Loading state remains; ensure errors are handled gracefully.

## Edge Cases

- Network failure on `/api/auth/signout` should still attempt client sign-out and show error if needed.

## Testing Strategy

- Manual QA via Chrome DevTools MCP in ops UI.
- Verify cookie deletion and no auto re-login on refresh.

## Rollout

- No feature flag; small fix.

## DB Change Plan (if applicable)

- Not applicable.
