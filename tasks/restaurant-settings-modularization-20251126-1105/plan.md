---
task: restaurant-settings-modularization
timestamp_utc: 2025-11-26T11:05:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Modularize Restaurant Settings

## Objective

Make restaurant configuration easier to find by moving Tables into Settings and splitting Restaurant Settings into dedicated modules (Profile, Operating Hours, Booking Occasions, Service Periods) with clear navigation.

## Success Criteria

- [ ] `/settings/restaurant/profile`, `/operating-hours`, `/occasions`, `/service-periods` each render the existing section with correct restaurant context and loading/error states.
- [ ] `/seating/tables` redirects to the new Settings path; sidebar nav shows Tables under Settings and highlights correctly on nested routes.
- [ ] No regressions in auth guard (unauthenticated users redirected to login); existing hooks still fetch data per restaurant.

## Architecture & Components

- Add a settings sub-layout (`src/app/app/(app)/settings/restaurant/layout.tsx`) that provides the shared page chrome and a reusable `RestaurantSettingsSubnav` (client) for the four modules.
- Create individual pages for each module under `/settings/restaurant/<module>/page.tsx` that reuse the existing section components (`RestaurantProfileSection`, `OperatingHoursSection`, `OccasionsSection`, `ServicePeriodsSection`).
- Update `/settings/restaurant/page.tsx` to redirect to `/settings/restaurant/profile` (was rendering all sections together).
- Move the Tables page to `/settings/tables/page.tsx` (reuse `TableInventoryClient`); keep `/seating/tables/page.tsx` as a redirect.
- Adjust `OPS_NAV_SECTIONS` to list the new settings destinations and remove Tables from the Seating group; ensure `match` functions cover nested routes.
- Update any static route references (e.g., screenshot script/route map) to the new paths.

## Data Flow & API Contracts

- All modules continue to use existing hooks/services (Supabase-backed) with restaurantId from `OpsSession`; no new APIs introduced.
- Redirects handled server-side in Next.js pages to preserve deep links and auth checks.

## UI/UX States

- Each module retains its existing loading/error/empty handling. New sub-nav should be keyboard-accessible, with active state reflecting current route.

## Edge Cases

- Users without memberships should see the existing “No restaurant access” empty state for the module pages.
- Direct visits to the old `/seating/tables` path should land on the new Tables settings page.
- Nested settings routes should still work when switching restaurants via the sidebar switcher.

## Testing Strategy

- Manual QA via Chrome DevTools MCP: navigate to each new settings page, verify nav highlighting, load states, and basic interactions (create/edit form not required to submit real data).
- Smoke checks: authenticated flow reaches each page; `/seating/tables` redirects; sidebar links point to new destinations.
- Accessibility: keyboard tab order through sub-nav links; focus visible; landmarks present.

## Rollout

- No feature flag; ship directly. Rollback by removing new routes and restoring previous navigation if issues arise.

## DB Change Plan (if applicable)

- Not applicable; no schema changes.
