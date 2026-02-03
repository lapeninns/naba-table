---
task: fix-localhost-app-redirect
timestamp_utc: 2026-02-02T19:58:18Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix localhost /app redirect

## Objective

We will prevent local `/app` routes from redirecting to production subdomain while developing on localhost.

## Success Criteria

- [ ] `http://localhost:3000/app` stays on localhost (no redirect to `app.nabatable.com`).
- [ ] Local cookies remain scoped to localhost.

## Architecture & Components

- `.env.local`: update `NEXT_PUBLIC_ROOT_DOMAIN` and add `NEXT_PUBLIC_LOCAL_APP_HOSTS`.

## Data Flow & API Contracts

- N/A.

## UI/UX States

- N/A.

## Edge Cases

- `127.0.0.1` should also be treated as local.

## Testing Strategy

- Manual: restart dev server and load `/app` on localhost.

## Rollout

- Local-only configuration change.

## DB Change Plan (if applicable)

- Not applicable.
