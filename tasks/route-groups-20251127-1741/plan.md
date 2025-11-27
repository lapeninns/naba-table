---
task: route-groups
timestamp_utc: 2025-11-27T17:41:38Z
owner: github:@amankumarshrestha
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Route group cleanup

## Objective

Organize public/unauthenticated pages under a `(public)` route group while keeping URLs unchanged.

## Success Criteria

- Public routes continue to resolve at the same URLs.
- Guest routes remain under `/guest` and restaurant routes under `/app`.

## Steps

- Create `src/app/(public)` route group.
- Move landing page, auth pages, public booking pages, and marketing booking flow into `(public)`.
- Ensure imports remain valid; no code changes to logic.

## Testing Strategy

- Smoke-check route file presence; no runtime tests planned for this reorg.
