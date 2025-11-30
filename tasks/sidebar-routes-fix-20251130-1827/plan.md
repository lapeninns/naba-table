---
task: sidebar-routes-fix
timestamp_utc: 2025-11-30T18:27:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix restaurant sidebar routes

## Objective

Ensure the restaurant-facing (ops) sidebar links navigate to existing pages under the `/app/...` path so operators can reach dashboard, bookings, seating, settings, and analytics sections from the shell.

## Success Criteria

- [ ] All sidebar links resolve to valid routes when clicked from any ops page.
- [ ] Active state highlighting continues to work for each section.
- [ ] Sign-out/auth navigation inside the ops shell routes to the correct auth page without 404s.

## Architecture & Components

- `src/components/features/ops-shell/navigation.tsx`: adjust `href` (and any custom `match`) strings to include `/app` prefix.
- `src/components/features/ops-shell/OpsSidebarLayout.tsx`: ensure sign-out redirect aligns with `/app/auth/signin` if needed.

## Data Flow & API Contracts

- No API changes; navigation constants consumed by client components.

## UI/UX States

- Sidebar behavior (active state, collapse) should remain unchanged; only destination paths change.

## Edge Cases

- Nested routes (e.g., `/app/settings/restaurant/profile`) should still match active state via `match` helper.
- External support link should remain mailto.

## Testing Strategy

- Manual click-through in dev: verify each sidebar item routes correctly.
- Smoke check active state per route using existing `match` logic.
- No automated tests modified.

## Rollout

- Direct change, no feature flag; available immediately after deploy.
