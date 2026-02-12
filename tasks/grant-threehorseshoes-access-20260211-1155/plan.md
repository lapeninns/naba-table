---
task: grant-threehorseshoes-access
timestamp_utc: 2026-02-11T11:55:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Grant Three Horseshoes access

## Objective

Grant `hello@threehorseshoes-pub.com` access to `three-horseshoes` restaurant in production.

## Success Criteria

- [x] Auth user exists for target email.
- [x] Restaurant membership exists for `three-horseshoes`.
- [x] Role is `owner`.

## Execution

- Resolve or create auth user by email via Supabase admin API.
- Run `scripts/grant-restaurant-access.ts` with production guards.
- Verify membership row by restaurant + user.
