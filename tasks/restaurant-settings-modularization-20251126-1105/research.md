---
task: restaurant-settings-modularization
timestamp_utc: 2025-11-26T11:05:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Modularize Restaurant Settings

## Requirements

- Functional:
  - Relocate the Tables management experience from `/seating/tables` into the Settings area so ops users find it with other configuration.
  - Split the current combined Restaurant Settings page into distinct, navigable sections: Restaurant Profile, Operating Hours, Booking Occasions, and Service Periods.
  - Provide navigation/IA that makes each settings module discoverable and keeps relevant pieces together only when necessary.
  - Preserve existing data flows (Supabase auth + ops session) and reuse the existing section components without regressions.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Maintain keyboard navigation and focus management in the new settings navigation (sidebar + in-page links).
  - Keep current performance expectations; do not introduce heavy client bundles on every settings view (lazy load where natural via route splits).
  - Auth remains enforced server-side before rendering settings routes; no new secrets added.

## Existing Patterns & Reuse

- Settings today live at `/settings/restaurant` and are rendered by `OpsRestaurantSettingsClient` in `src/components/features/restaurant-settings/OpsRestaurantSettingsClient.tsx`, which already composes four section components: `RestaurantProfileSection`, `OperatingHoursSection`, `OccasionsSection`, `ServicePeriodsSection`.
- The Tables experience is at `/seating/tables` via `TablesPage` (server) + `TableInventoryClient` (client). Navigation entry resides under the “Seating” section in `src/components/features/ops-shell/navigation.tsx`.
- Settings index (`/settings`) simply redirects to `/settings/restaurant`.
- The Ops shell/sidebar is built from `OPS_NAV_SECTIONS`; matches via `match` predicates.

## External Resources

- None needed; all components and data hooks already exist in-repo.

## Constraints & Risks

- Removing/renaming the `/seating/tables` route can break bookmarks or tests; should add a redirect to the new settings path.
- Nested settings routes must still resolve `restaurantId` from `OpsSession`; if a view loads without memberships, existing empty states should remain intact.
- Need to ensure sidebar active-state logic matches nested routes so users see which page they are on.
- Manual UI QA via Chrome DevTools MCP required for UI changes.

## Open Questions (owner, due)

- Q: Should “Tables” live under the Restaurant settings sub-nav or as its own Settings entry? (Assume separate Settings item unless told otherwise.)
  A: Pending confirmation; proceed with standalone `/settings/tables` plus redirect from old path.

## Recommended Direction (with rationale)

- Introduce a nested Settings structure: keep `/settings` redirecting to `/settings/restaurant/profile` and add dedicated routes for each module (`profile`, `operating-hours`, `occasions`, `service-periods`). This modularizes IA without rewriting the section components.
- Move the Tables server/client page to `/settings/tables` and add a server-side redirect from `/seating/tables` to prevent breakage. Update sidebar navigation to list settings modules (Profile, Hours, Occasions, Service Periods, Tables) under the Settings label.
- Reuse existing components and auth/session guards from current pages to minimize change surface while achieving the requested IA.
