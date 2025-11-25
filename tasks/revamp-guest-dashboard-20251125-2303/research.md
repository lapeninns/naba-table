---
task: revamp-guest-dashboard-20251125-2303
timestamp_utc: 2025-11-25T23:03:04Z
owner: github:@amankumarshrestha
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Research: Revamp Guest Dashboard

## Requirements

- **Functional**:
  - Display active/upcoming bookings clearly.
  - Show favorite restaurants for quick rebooking.
  - Show discovery feed of available restaurants.
  - Provide quick actions (update profile, see all bookings).
  - "Great logic": Smart greeting, context-aware actions (e.g., "Running late" only when close to time).
- **Non-functional**:
  - **Aesthetics**: Premium, modern, consistent with Shadcn UI.
  - **UX**: Smooth transitions, clear hierarchy, mobile-responsive.
  - **Performance**: Fast load, optimistic UI where possible.

## Existing Patterns & Reuse

- **Components**: `components/ui/*` (Shadcn) are available.
- **Hooks**: `useBookings`, `useRestaurants`, `useSupabaseSession`.
- **Logic**: `deriveBookingState` in `booking-derivations.ts` handles sorting and filtering.

## Analysis of Current Implementation (`GuestDashboardClient.tsx`)

- **HeroBanner**: Uses a static Unsplash image with an overlay. Text is readable but could be more dynamic.
- **ActiveReservationCard**: Functional but looks a bit generic. Could be more "ticket-like".
- **FavoritesRail**: Horizontal scroll is good.
- **DiscoveryFeed**: Grid of cards.
- **PerksCard**: A bit hidden at the bottom/side.

## Recommended Direction

1.  **Hero Section**:
    - Make it more personal. "Good evening, Aman."
    - If there's an active booking, the hero should focus on THAT, not a generic "Explore".
    - Use a better background or a subtle gradient animation.

2.  **Active Booking Card**:
    - Elevate this. If I have a booking _tonight_, it should be the most important thing.
    - Add "Add to Wallet" or "Share" as primary actions.
    - Visuals: Glassmorphism or a distinct card style to separate it from "content".

3.  **Discovery & Favorites**:
    - Improve the "empty state" for favorites.
    - Make the restaurant cards cleaner.

4.  **Layout**:
    - Keep the 2-column layout on desktop (Main content + Sidebar).
    - Sidebar can hold "Perks" and "Next Steps".

5.  **Logic**:
    - Ensure `deriveBookingState` correctly identifies "Live" vs "Upcoming".
    - The current logic seems okay, but we can refine the "time to booking" display.

## Constraints & Risks

- **Data**: We rely on `useBookings` and `useRestaurants`. If they are slow, we need good skeletons.
- **Images**: We are using Unsplash URLs. Ensure they are reliable or use local assets/placeholders.
