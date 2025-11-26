---
task: restaurant-settings-revamp
timestamp_utc: 2025-11-26T12:59:00Z
owner: github:@antigravity
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Restaurant Settings Pages Revamp

## Objective

Revamp all pages within the Restaurant Settings section to achieve visual and functional consistency while preserving all existing features and functionality intact.

## Success Criteria

- [ ] All 5 pages (Profile, Hours, Service Periods, Tables, Occasions) share a consistent look and feel.
- [ ] Mobile responsiveness is verified for all pages.
- [ ] No regression in functionality (data saving, validation, logic).
- [ ] Shared component library is established and used.

## Architecture & Components

### Shared Components (`src/components/features/restaurant-settings/shared/`)

- `SettingsPageLayout`: Enhanced version of `RestaurantSettingsPageShell` (or replacement).
- `SettingsCard`: Wrapper for sections (Title, Description, Content, Footer/Actions).
- `SettingsForm`: Standardized form layout.
- `SettingsSectionHeader`: Consistent header for sections.

### Page Refactoring

1.  **Restaurant Profile** (`/settings/restaurant/profile`)
    - Refactor `RestaurantProfileSection` to use shared components.
2.  **Operating Hours** (`/settings/restaurant/operating-hours`)
    - Refactor `OperatingHoursSection`.
    - Ensure complex time selection logic is preserved but styled consistently.
3.  **Service Periods** (`/settings/restaurant/service-periods`)
    - Refactor `ServicePeriodsSection`.
4.  **Tables** (`/settings/tables`)
    - Refactor `TableInventoryClient`.
5.  **Booking Occasions** (`/settings/restaurant/occasions`)
    - Refactor `OccasionsSection`.

## Testing Strategy

- **Manual QA**: Verify each page on mobile, tablet, and desktop.
- **Regression Testing**: Check data persistence and validation for each form.
- **Accessibility**: Check keyboard navigation and screen reader support.

## Rollout

- Direct update to existing pages. No feature flags as this is a revamp of existing pages.
