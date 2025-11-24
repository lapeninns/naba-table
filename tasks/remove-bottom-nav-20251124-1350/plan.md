---
task: remove-bottom-nav
timestamp_utc: 2025-11-24T13:50:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Remove Bottom Navigation

## Objective

Remove the bottom navigation bar from the Guest Dashboard. The user has indicated they do not want this element. The application already has a top navigation bar with a mobile menu, making the bottom navigation redundant.

## Success Criteria

- [ ] Bottom navigation bar is removed from the Guest Dashboard on mobile view.
- [ ] No build errors or unused code left behind.

## Architecture & Components

- **Component**: `src/components/features/guest/dashboard/GuestDashboardClient.tsx`
- **Action**: Remove `BottomTabNav` component and its usage.

## Execution Steps

1.  **Edit `GuestDashboardClient.tsx`**:
    - Remove `<BottomTabNav />` from the JSX.
    - Remove `BottomTabNav` function definition.
    - Remove `BottomNavProps`, `NavItem`, `LinkOrButton`, `LinkOrButtonProps` types.
    - Clean up unused imports if any (though most icons seem used elsewhere).

## Verification

- **Manual**:
  - Open the dashboard on a mobile viewport.
  - Verify the bottom navigation bar is gone.
  - Verify the top navigation (hamburger menu) still works.
