---
task: remove-navbar-links
timestamp_utc: 2025-11-24T14:00:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Remove Dashboard and My Bookings from Navbar

## Objective

Remove "Dashboard" and "My bookings" links from the main navigation bar (both desktop and mobile). These links are currently defined in `APP_LINKS`.

## Success Criteria

- [ ] "Dashboard" and "My bookings" links are removed from the desktop navbar.
- [ ] "Dashboard" and "My bookings" links are removed from the mobile menu "Explore" section.
- [ ] The "Explore" section in the mobile menu is hidden if there are no links.

## Architecture & Components

- **Component**: `components/Header.tsx`
- **Action**:
  - Empty `APP_LINKS` array.
  - Conditionally render the "Explore" section in `MobileMenu`.

## Execution Steps

1.  **Edit `components/Header.tsx`**:
    - Set `APP_LINKS` to `[]`.
    - In `MobileMenu`, wrap the "Explore" section with `{navLinks.length > 0 && ( ... )}`.

## Verification

- **Manual**:
  - Open the app on desktop. Verify no links appear in the center of the navbar.
  - Open the app on mobile. Open the hamburger menu. Verify the "Explore" section is gone (or empty).
  - Verify "My bookings" is still accessible via the User Dropdown (Account) if it was there (it is in `ACCOUNT_LINKS`).
