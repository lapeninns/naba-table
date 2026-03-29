---
task: ops-dashboard-refactor
timestamp_utc: 2026-03-29T07:12:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Plan: Ops Dashboard Refactor

## Objective

Refactor the existing operations dashboard around a simpler data and realtime architecture while preserving current user-visible behavior.

## Success Criteria

- [ ] Dashboard uses one browser Supabase client for auth and realtime.
- [ ] Dashboard data and refresh state are owned by one hook.
- [ ] Booking list receives pre-shaped booking items and does less row-level derivation.
- [ ] Existing booking flows and URL-driven state are preserved.

## Architecture & Components

- `useOpsDashboardData`: unified data/realtime/polling hook for summary data.
- `server/ops/bookings.ts`: normalize dashboard DTOs for rendering.
- `useOpsDashboardState`: split into query, data, and UI command composition.
- Booking list: render using normalized items, keep virtualization and optimistic actions.

## Testing Strategy

- Unit tests for normalized server mappers and dashboard selectors.
- Integration tests for summary route and unified dashboard data hook behavior.
- Manual Chrome DevTools verification for console, accessibility, and performance.
