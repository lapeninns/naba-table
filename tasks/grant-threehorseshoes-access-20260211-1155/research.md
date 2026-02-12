---
task: grant-threehorseshoes-access
timestamp_utc: 2026-02-11T11:55:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Grant restaurant access for hello@threehorseshoes-pub.com

## Requirements

- Grant requested email access to restaurant slug `three-horseshoes` in production.

## Existing Patterns & Reuse

- Canonical script: `scripts/grant-restaurant-access.ts`.
- Auth user provisioning via Supabase admin API when user does not exist.

## Constraints & Risks

- Production writes require `CONFIRM_PRODUCTION=true` and project ref guard.
- Membership cannot be created until auth user exists.

## Recommended Direction

- Ensure auth user exists for target email.
- Grant `owner` role membership for `three-horseshoes` via canonical script.
