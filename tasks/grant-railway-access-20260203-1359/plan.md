---
task: grant-railway-access
timestamp_utc: 2026-02-03T13:59:56Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Grant Railway Pub Access

## Objective

Grant the specified user access to The Railway Pub in production.

## Success Criteria

- [ ] User has a membership for the Railway Pub with the desired role.

## Architecture & Components

- `scripts/grant-restaurant-access.ts`

## Data Flow & API Contracts

- Resolve restaurant by id/slug.
- Resolve user by id/email via auth admin API.
- Insert/update `restaurant_memberships`.

## UI/UX States

- N/A

## Edge Cases

- User not found by email.
- Membership exists with different role.

## Testing Strategy

- Script run in production; verify membership row.

## Rollout

- One-off execution.

## DB Change Plan (if applicable)

- N/A
