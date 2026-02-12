---
task: perf-app-layout-memberships
timestamp_utc: 2026-02-12T15:55:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Plan: Speed Up `/app/*` Hard Reload

## Objective

Reduce hard reload latency for `/app/*` routes by avoiding repeated remote membership lookups when data is stable.

## Implementation

1. Add a cached membership function in `server/team/access.ts`:
   - Keyed by `userId`.
   - TTL (default: 30s).
   - Bounded max entries to avoid unbounded memory growth.
   - Do not cache failures.
2. Update `src/app/app/(app)/layout.tsx` to call the cached membership function.
3. Trim the membership select to only required columns.

## Verification

- Typecheck + lint.
- Manual (requires authenticated ops session):
  - Refresh `/app/floor-plan` twice. Second refresh should have clearly lower TTFB.
  - Ensure redirect to `/app/auth/signin` still works when logged out.
  - Ensure restaurant selector and nav still work.

## Rollback

- Revert to uncached `fetchUserMemberships` in layout.
- Keep select changes minimal to revert easily.
