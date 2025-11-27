---
task: route-groups
timestamp_utc: 2025-11-27T17:41:38Z
owner: github:@amankumarshrestha
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Research: Route group clarity

## Requirements

- Separate public/unauthenticated pages into a `(public)` route group (no URL change).
- Keep guest routes under `/guest` and restaurant routes under `/app` as-is.

## Existing Patterns & Reuse

- Next.js app router already uses route groups `(app)` and `(marketing)` for organization.
- Imports use path aliases (`@/...`), so moving files within `src/app` won’t break them.

## Constraints & Risks

- Must preserve URL structure; only organizational changes.
- Avoid breaking relative imports (none observed in targeted pages).

## Open Questions

- None for this small reorg.

## Recommended Direction

- Create `(public)` route group and move public pages (`/`, `/auth/*`, `/bookings/*`, `(marketing)` booking flows) under it; leave guest and restaurant app untouched.
