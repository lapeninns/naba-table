---
task: app-dashboard-first-load-issue
timestamp_utc: 2025-12-27T18:42:31Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Enforce app-host auth flow for ops sign-in

## Objective

We will enforce ops sign-in to occur on the app subdomain so app-host session cookies are established and `/dashboard` loads on first visit.

## Success Criteria

- [ ] Guest sign-in page redirects ops sign-in attempts to `app.<root>` when redirectedFrom targets ops routes.
- [ ] App subdomain `/dashboard` first visit no longer depends on visiting another route first.

## Architecture & Components

- `src/app/(public)/auth/signin/page.tsx`: add app-host redirect for ops targets.
- `src/app/app/auth/signin/page.tsx`: continue handling ops auth on app host.

## Data Flow & API Contracts

- Ops auth flow remains: `/auth/signin` -> `/api/auth/signin` -> `/api/auth/callback` -> `/dashboard`.

## UI/UX States

- Loading / Error states for dashboard if applicable.

## Edge Cases

- app.localhost vs app.<rootDomain>.
- First load without existing session or cookies.

## Testing Strategy

- Manual reproduction: navigate to `/auth/signin?redirectedFrom=/dashboard` on root host and confirm redirect to app host.

## Rollout

- No feature flag; dev/prod consistent behavior.

## DB Change Plan (if applicable)

- Not applicable.
