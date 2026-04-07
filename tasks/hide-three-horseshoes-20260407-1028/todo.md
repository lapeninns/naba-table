---
task: hide-three-horseshoes
timestamp_utc: 2026-04-07T10:28:00Z
owner: github:@OpenAI
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Inspect public restaurant lookup/list paths and ops restaurant update path
- [x] Add task artifacts and continuity update

## Core

- [x] Exclude inactive restaurants from public list queries
- [x] Exclude inactive restaurants from public slug resolution
- [x] Add `isActive` to ops restaurant update contracts and response DTOs
- [x] Ensure the update service persists `restaurants.is_active`

## UI/UX

- [x] Preserve public `notFound` behavior for inactive venue detail and booking pages

## Tests

- [x] Public restaurant pages coverage
- [x] Ops restaurant payload/cache coverage if touched

## Notes

- Assumptions:
- `restaurants.is_active` is the intended canonical visibility switch because no separate subscription domain was found in-repo.
- Production access via Supabase service-role credentials was available in-repo for a one-row state change.
- Deviations:
- Browser verification used a local Next dev server with placeholder values for unrelated required env keys because the checked-in env files do not define them.

## Batched Questions

- None
