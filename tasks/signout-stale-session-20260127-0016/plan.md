---
task: signout-stale-session
timestamp_utc: 2026-01-27T00:16:44Z
owner: github:@copilot
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Make Sign-out Idempotent and Immediate

## Objective

We will make sign-out idempotent and ensure UI state transitions immediately without requiring a reload.

## Success Criteria

- [x] Sign-out no longer fails when the session is already missing.
- [x] Auth cookies are cleared even when Supabase reports a missing session.
- [x] Client-side sign-out proceeds to redirect/cache clear even on missing-session errors.
- [x] Targeted sign-out tests pass.

## Architecture & Components

- `src/app/api/auth/signout/route.ts`: server sign-out and cookie clearing.
- `lib/supabase/signOut.ts`: client sign-out orchestration.
- `hooks/useSupabaseSession.tsx`: session state reacts to SIGNED_OUT events.

## Data Flow & API Contracts

- Endpoint: `POST /api/auth/signout`
- Invariant: sign-out is idempotent and returns success when already signed out.

## Edge Cases

- Missing/expired session (Supabase returns "Auth session missing!").
- Cookies present but no session.
- Session already cleared in browser but still present server-side.

## Testing Strategy

- Add focused sign-out tests around missing-session behavior.
- Run targeted Vitest suites.

## Rollout

- No flag; deploy normally and monitor `/api/auth/signout` error rates.

## DB Change Plan (if applicable)

- None.
