# Redesign Brief: Discovery in Profile

## Problem

Optional Business Context and Discovery Details (dining categories, amenities, attributes, online links, service areas, and service items) are currently embedded within the core **Profile** settings section. While the booking slug has been successfully extracted to its own section, having these six massive, optional discovery families in the main profile flow causes significant cognitive overload for first-time operators. Additionally, `RestaurantBusinessContextSection.tsx` and the underlying editor handlers manage dirty state at a per-family level, complicating the Unified Action Bar on the profile page.

## Proposed IA

1. **Route Promotion**: Extract all discovery-related components out of the `/settings/restaurant/profile` path entirely. Promote them to a standalone Next.js route: `/settings/restaurant/discovery`.
2. **Nav Separation**: Add a new subnav item under the "Operations" or "Integrations" group in the sidebar (configured in `useRestaurantSettingsNav.ts`).
3. **Overview Linkage**: Add a dedicated completion card or secondary action on the `RestaurantSetupOverview` dashboard highlighting "Public Discovery Details (Optional)" with a progress counter (e.g., "3 of 6 attributes synced").
4. **Conditional Mounting**: By moving discovery to its own view in `OpsRestaurantSettingsClient.tsx`, we eliminate `ProfileLoadedView` having to lazy-load or keep six hidden panels mounted in the DOM, boosting profile render performance.

## Non-Goals

- No backend database schema changes or API endpoint overrides.
- No modifications to the public-facing guest marketing pages.
- No change to the underlying `useRestaurantBusinessContextEditor` react-query schema, only route trigger and UI shell adjustments.

## Files Touched

- `src/components/features/restaurant-settings/routes.ts` (add discovery route metadata)
- `src/components/features/restaurant-settings/useRestaurantSettingsNav.ts` (add to sidebar nav groups)
- `src/components/features/restaurant-settings/OpsRestaurantSettingsClient.tsx` (add `discovery` view switcher case)
- `src/components/features/restaurant-settings/RestaurantProfileSection.tsx` (remove embedded panels)
- `src/app/app/(app)/settings/restaurant/profile/page.tsx` (remove discovery imports/handling)
- `src/app/app/(app)/settings/restaurant/discovery/page.tsx` (create new route entry point)

## Risks

- **Dirty State Interrupts**: We must ensure that navigation away from the new discovery tab prompts the operator via `useOpsUnsavedChanges()` if any of the six panels have unsubmitted edits.
- **Deep Hash Anchors**: Direct links to `#discovery-attributes` or `#discovery-links` from Google Business Profile sync screens must be redirected to the new `/settings/restaurant/discovery#attributes` path to avoid broken compare journeys.
