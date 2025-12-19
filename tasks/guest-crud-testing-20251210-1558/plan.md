# Guest CRUD Testing Plan

## Objective

Perform comprehensive CRUD testing of guest-facing routes and pages, covering both **Authenticated** (Profile, My Bookings) and **Unauthenticated** (Public Booking Wizard) flows.

## Scope

1.  **Authenticated Guest Flow** (per `/guest_crud_testing` workflow)
    - **Login**: `/auth/signin`
    - **Profile Update**: `/guest/profile`
    - **Create Booking**: `/restaurants/white-horse-pub-waterbeach/book`
    - **Read Booking**: `/guest/bookings` & `/guest/bookings/[ID]`
    - **Update Booking**: `/guest/bookings/[ID]` (Edit party size)
    - **Cancel Booking**: `/guest/bookings/[ID]` (Cancel)

2.  **Unauthenticated Guest Flow** (verifying API optimizations in UI)
    - **Create Booking**: Public Wizard -> Confirmation Page.
    - **Read Booking**: Confirmation Page (Token-based lookup).

## Execution Strategy

- Use `browser_subagent` to execute the steps.
- Record artifacts (screenshots/videos handled by subagent).
- Log results in `verification.md`.

## Prerequisites

- Server running on port 3000 (Checked: Running).
- User `amanshresthaaaaa@gmail.com` exists.
