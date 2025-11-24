---
task: revamp-user-dropdown
timestamp_utc: 2025-11-24T14:10:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Verification: Revamp User Dropdown

## Manual Verification Steps

1.  **Trigger Appearance**:
    - Hover over the user avatar in the navbar.
    - Verify a subtle primary ring or border change appears.
    - Verify the avatar has a clean border.

2.  **Dropdown Content**:
    - Click the avatar to open the dropdown.
    - Verify the width is wider (`w-60`).
    - Verify the user name and email are displayed clearly at the top with good spacing.
    - Verify "Profile" and "My bookings" items have icons (`User` and `Calendar` respectively).
    - Verify hover effects on items (subtle primary background).

3.  **Sign Out**:
    - Verify the "Sign out" button is at the bottom, separated by a line.
    - Verify it has a destructive (red) color on hover/focus.
    - Verify the `LogOut` icon is present.

4.  **Responsiveness**:
    - Check mobile view (hamburger menu) to ensure no regressions (the mobile menu uses a different structure but shares some data). _Note: Mobile menu was not explicitly revamped in this task but uses `ACCOUNT_LINKS`. Since we changed `ACCOUNT_LINKS` type, we should verify mobile menu doesn't break._

## Regression Check (Mobile Menu)

- The `MobileMenu` component iterates over `sessionActions` (which is `ACCOUNT_LINKS`).
- It renders links using `Link`.
- We added an `icon` property to `ACCOUNT_LINKS`.
- `MobileMenu` does not currently use the `icon` property, but extra properties shouldn't break it.
- **Action**: Verify mobile menu still renders "Profile" and "My bookings" correctly.
