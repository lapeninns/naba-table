# Redesign Brief: Save Boundaries

## Problem

Operators are exposed to three distinct save models in a single route cluster:

- **Profile**: A floating `UnifiedActionBar` that triggers subform validations (`brand`, `contact`, `advanced`) and saves everything in one transaction.
- **Discovery**: Individual inline save buttons for each of the six panels (`Basics`, `Links`, `Categories`, `Areas`, `Attributes`, `Items`), saving only that specific data block.
- **Availability**: A massive multi-domain save handler inside `AvailabilityScheduleManager` that validates weekly schedule hours, booking rules, exceptions, and booking types all at once.

This technical split is necessary to prevent backend transaction locks, but the UI fails to explain these boundaries. Operators are left wondering if navigating away will discard changes or if saving in one area overrides another.

## Proposed IA

1. **Scope Messaging**: Standardize visual captions using `formatSaveScopeMessage` helper classes. Every save button must clearly label its commit range, e.g. _"Saves Weekly Schedule and overrides only"_ or _"Saves manager notification alerts"_.
2. **Tab-Drift Alerts**: Implement sub-sidebar badges using `useOpsUnsavedChanges()` hook values. If a tab contains unsaved fields, render a tiny orange alert badge next to its link in the sidebar, showing operators exactly where they have pending changes.
3. **Dirty Intercept Refinement**: Modify the layout-level escape hatch confirmation dialog to explicitly list the unsaved categories (e.g. _"You have unsaved changes in: [Weekly hours, Amenities]. Exit anyway?"_).

## Non-Goals

- No backend endpoint merging; do not combine Profile, GBP, and Availability REST/GraphQL operations into a single massive API.
- No changes to client-side react-query query invalidation pipelines.

## Files Touched

- `src/components/features/restaurant-settings/shared/compactSettingsClasses.ts`
- `src/components/features/restaurant-settings/profile/UnifiedActionBar.tsx`
- `src/components/features/restaurant-settings/AvailabilityScheduleManager.tsx`
- `src/components/features/restaurant-settings/RestaurantBusinessContextSection.tsx`
- `src/components/features/restaurant-settings/RestaurantSettingsSidebar.tsx`

## Risks

- **Density Overlap**: Standardizing alerts must align perfectly with `opsDensityClasses.ts` to ensure sticky save footers do not cover input fields or overlap with horizontal mobile navigation scroll lines.
- **Performance Drift**: Checking dirty state recursively across nested forms can lead to frame drops on cheaper devices. Dirty tracking should use light, flat key-value state objects.
