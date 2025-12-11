---
task: auth-redirect
timestamp_utc: 2025-12-11T07:52:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Auth redirect default home

## Objective

We will enable authenticated users to land on the guest dashboard by default so they rarely hit the root homepage.

## Success Criteria

- [ ] Authenticated sessions redirect to `/guest/dashboard` when navigating to `/`.
- [ ] Unauthenticated users continue to see the current root behavior.

## Architecture & Components

- Update `src/app/(public)/page.tsx` server component to check Supabase user and, if present, immediately `redirect("/guest/dashboard")` before rendering the marketing layout.
- Keep existing marketing layout and FactoryHomeClient usage for unauthenticated users.

## Data Flow & API Contracts

- Uses existing server-side Supabase client (`getServerComponentSupabaseClient`) to fetch the session/user.
- No new API contracts; only read auth state and perform a server redirect via Next.js App Router utilities.

## UI/UX States

- N/A (behavioral redirect) unless root page content changes.

## Edge Cases

- Avoid redirect loops: only trigger when a user exists and path is `/`.
- Ensure marketing experience remains for unauthenticated visitors.
- Respect host routing handled in `src/middleware.ts`; no changes required there.

## Testing Strategy

- Add a unit test for `src/app/(public)/page.tsx` that mocks Supabase auth to cover:
  - Authenticated request results in redirect to `/guest/dashboard`.
  - Unauthenticated request renders marketing shell (snapshot/minimal assertion).

## Rollout

- Single release; no flag. Behavior is server-side and low-risk. Monitor for unexpected redirects via logs if available.

## DB Change Plan (if applicable)

- N/A.
