---
task: restaurant-settings-revamp
timestamp_utc: 2025-11-26T12:59:00Z
owner: github:@antigravity
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Research: Restaurant Settings Pages Revamp

## Requirements

### Functional

- **Zero Feature Regression**: All existing functionality must remain fully operational.
- **Mobile-First**: Design for mobile viewports first, then progressively enhance.
- **Shared Architecture**: Extract common patterns into a unified settings component library.
- **Standardized Elements**: Page structure, form patterns, interactive elements, navigation.

### Non-functional

- **Accessibility**: WCAG 2.1 AA compliance (keyboard nav, focus management, screen reader labels).
- **Performance**: Fast load times, optimistic UI updates.
- **Visual Excellence**: Premium, modern aesthetic (Shadcn UI).

## Existing Patterns & Reuse

- **Current Layout**: `RestaurantSettingsPageShell` exists and is used by `TablesPage`. It includes `RestaurantSettingsSubnav`.
- **Routes**: Defined in `src/components/features/restaurant-settings/routes.ts`.
- **Components**:
  - `RestaurantProfileSection.tsx`
  - `OperatingHoursSection.tsx`
  - `ServicePeriodsSection.tsx`
  - `OccasionsSection.tsx`
  - `TableInventoryClient.tsx` (for Tables)

## External Resources

- **Shadcn UI**: Primary component library.
- **Lucide Icons**: Iconography.

## Constraints & Risks

- **Risk**: Regression in complex logic (e.g., Operating Hours, Service Periods) during refactoring.
- **Constraint**: Must preserve existing routes and URL structures.
- **Constraint**: No backend API changes unless necessary.

## Recommended Direction

1.  **Shared Component Library**: Create `src/components/features/restaurant-settings/shared/` to house reusable components (Layout, Cards, Forms).
2.  **Refactor `RestaurantSettingsPageShell`**: Enhance it to meet the new design requirements (if needed) or ensure it's fully utilized.
3.  **Iterative Refactor**: Tackle one page at a time, starting with `Restaurant Profile` as it's likely the simplest, then moving to more complex ones like `Operating Hours`.
4.  **Mobile-First**: Verify every component on mobile width during development.
