---
task: revamp-user-dropdown
timestamp_utc: 2025-11-24T14:05:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Revamp User Dropdown

## Objective

Revamp the User Dropdown menu in the navigation bar to be more visually appealing, consistent with modern design trends, and user-friendly.

## Success Criteria

- [ ] Dropdown trigger (Avatar) looks interactive and premium.
- [ ] Dropdown content has better spacing, typography, and visual hierarchy.
- [ ] Menu items include relevant icons.
- [ ] "Sign out" action is clearly distinct.

## Architecture & Components

- **Component**: `components/Header.tsx`
- **Icons**: Import `User`, `Calendar`, `LogOut` from `lucide-react`.

## Execution Steps

1.  **Update Imports**: Add `User`, `Calendar` to `lucide-react` imports.
2.  **Refactor Dropdown Trigger**:
    - Remove the raw `button` border/background styles, make it cleaner.
    - Add a subtle ring/offset on focus/hover.
3.  **Refactor Dropdown Content**:
    - Increase width to `w-60` or `w-64`.
    - Add padding `p-2`.
    - Style the User Info header (name/email) with better spacing and maybe a background accent.
4.  **Refactor Menu Items**:
    - Map `ACCOUNT_LINKS` to include icons.
    - Add icons to the rendered items.
    - Improve hover states.

## Verification

- **Manual**:
  - Log in to the app.
  - Click the user avatar.
  - Verify the new design matches the intent (icons, spacing, colors).
