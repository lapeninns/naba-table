---
task: restrict-oldcrown-access
timestamp_utc: 2026-01-24T20:42:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Restrict Old Crown user access

## Requirements

- Functional: Remove `oldcrown@lapeninn.com` access to all restaurants except Old Crown Girton.
- Non-functional: Supabase remote-only; avoid exposing secrets.

## Existing Patterns & Reuse

- Restaurant access via `public.restaurant_memberships`.

## Constraints & Risks

- Ensure correct user (lapeninn.com domain) and correct restaurant to keep.

## Recommended Direction

- Lookup user and memberships; delete all memberships not matching Old Crown Girton.
