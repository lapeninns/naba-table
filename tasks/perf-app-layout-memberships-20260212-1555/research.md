---
task: perf-app-layout-memberships
timestamp_utc: 2026-02-12T15:55:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Slow Hard Reload For `/app/*`

## Symptom

- Hard reload on `/app/*` (e.g. `/app/floor-plan`) can take ~20-30s.
- Client-side navigation between pages is fast.

## Observations

- `/app/*` is gated by the ops layout at `src/app/app/(app)/layout.tsx`.
- The layout performs remote Supabase operations before rendering:
  - `supabase.auth.getUser()`
  - `fetchUserMemberships(userId)`
- These operations are sequential network calls and occur on every hard reload.

## Likely Root Causes

- Remote latency (Supabase auth validation + DB read).
- Membership query returns more data than needed.
- No caching: memberships are fetched every request even though they change infrequently.

## Constraints

- Must maintain correct AuthN/AuthZ and tenant boundaries.
- Supabase is remote-only.

## Recommended Direction

- Add a small, bounded TTL cache for membership lists keyed by `userId`.
- Trim membership select to only fields used by the ops layout and memberships API.
- Keep `fetchUserMemberships(userId, client)` behavior intact for explicit callers; introduce a dedicated cached variant used by ops layout.
