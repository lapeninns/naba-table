---
task: grant-oldcrown-staging-access
timestamp_utc: 2026-03-19T00:25:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Grant Old Crown staging access

## Objective

We will grant `oldcrown@lapeninns.com` access to `The Old Crown Girton` in staging so the account can manage that restaurant in the current staging environment.

## Success Criteria

- [ ] Canonical grant script executes successfully against staging.
- [ ] Membership exists for `oldcrown@lapeninns.com` on `the-old-crown-girton`.
- [ ] Verification evidence is captured in task artifacts.

## Architecture & Components

- `scripts/grant-restaurant-access.ts`: resolve restaurant and user, then insert/update `restaurant_memberships`.

## Testing Strategy

- Run grant script.
- Query resulting membership state.

## Rollout

- Direct staging data change only.
