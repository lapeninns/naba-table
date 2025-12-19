---
task: guest-pages-audit
timestamp_utc: 2025-12-03T19:07:59Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Guest-Facing Routes Inventory

## Objective

Identify all guest-facing Next.js routes and label them as protected (auth-required) or unprotected, adding subcategories (marketing, auth, booking, dashboard) if helpful.

## Success Criteria

- [ ] All public-facing routes under `src/app` are listed with URL paths.
- [ ] Each route labeled protected/unprotected with brief auth rationale.
- [ ] Subcategories applied where they clarify purpose (e.g., marketing, auth, booking, dashboard).
- [ ] Source paths noted for traceability.

## Approach

- Use `node route-scanner.js` to gather current routes (pages only; APIs out of scope).
- Inspect auth enforcement points: `middleware.ts`, `src/app/guest/layout.tsx`, any guard hooks, and route group conventions.
- Review existing `guest-facing-routes.md` for prior categorization and update/confirm.
- Consolidate into final categorized list.

## Data & State

- No data mutations. Read-only repository inspection.

## Edge Cases

- Dynamic routes (e.g., booking links with tokens) should be represented with parameter notation.
- Exclude dev/preview routes unless reachable by guests.

## Testing Strategy

- Manual verification only: cross-check generated routes against directory structure and middleware coverage.

## Rollout

- None (informational task only).
