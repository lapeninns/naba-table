---
task: revamp-guest-dashboard-20251125-2303
timestamp_utc: 2025-11-25T23:03:04Z
owner: github:@amankumarshrestha
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Revamp Guest Dashboard

## Objective

Revamp the Guest Dashboard (`/guest/dashboard`) to be visually stunning, logically sound, and consistent with the platform's premium design.

## Success Criteria

- [ ] Hero section is dynamic and personalized.
- [ ] Active booking card is prominent and "ticket-like".
- [ ] UI uses Shadcn components and Tailwind utility classes effectively.
- [ ] Layout is responsive (mobile-first).
- [ ] "Great logic" is evident in state handling (Live vs Upcoming vs Hungry).

## Architecture & Components

We will refactor `GuestDashboardClient.tsx` into smaller, focused components (if they get too large), but for now, keeping them in one file (or co-located) is fine for simplicity, as long as the code is clean.

### 1. `HeroBanner` (Revamped)

- **State**: `hungry` | `upcoming` | `live`
- **Visuals**:
  - Use a subtle gradient background or a high-quality food image with a dark overlay.
  - Greeting: "Good evening, [Name]".
  - Call to Action (CTA):
    - Hungry: "Find a table" (Primary), "View map" (Secondary).
    - Upcoming: "View ticket" (Primary), "Get directions" (Secondary).
    - Live: "View menu" (Primary), "Ask for bill" (Secondary - placeholder).

### 2. `ActiveReservationCard` (Revamped)

- **Design**: "Boarding Pass" style.
  - Left side: Restaurant details, Date, Time, Party Size.
  - Right side (or bottom on mobile): QR Code (simulated), "Check-in" status.
  - Actions: "Modify", "Cancel", "Share".
- **Logic**:
  - Show "Running late" button if within 30 mins of start time.
  - Show "Get Directions" always.

### 3. `DiscoveryFeed` & `FavoritesRail`

- **Design**:
  - Use `Card` with `overflow-hidden`.
  - Images: Use `logoUrl` if available, otherwise fallback to nice gradients or placeholders.
  - Typography: Clean Sans-serif (Inter).

### 4. `PerksCard`

- **Design**:
  - Make it look like a credit card or membership card.
  - Show progress bar clearly.

## Data Flow

- `useBookings` -> `deriveBookingState` -> `HeroState` & `ActiveBooking`.
- `useRestaurants` -> `DiscoveryFeed`.

## Testing Strategy

- **Manual QA**:
  - Check "Hungry" state (no bookings).
  - Check "Upcoming" state (create a booking for tomorrow).
  - Check "Live" state (create a booking for right now).
  - Verify responsiveness on mobile view.

## Rollout

- Direct update to `GuestDashboardClient.tsx`.
- Ensure no regressions in routing or data fetching.
