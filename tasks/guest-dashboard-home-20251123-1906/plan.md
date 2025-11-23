---
task: guest-dashboard-home
timestamp_utc: 2025-11-23T19:06:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Guest Dashboard Home

## Objective

Make `/dashboard` the authenticated guest home that blends reservation utility with discovery inspiration: show active/upcoming bookings, quick actions, favorites, discovery cards, perks, and mobile navigation.

## Success Criteria

- [ ] `/dashboard` exists, gated by Supabase session; unauthenticated users are redirected to sign-in with `redirectedFrom=/dashboard`.
- [ ] Hero state adapts to booking context (empty vs upcoming vs live) and shows relevant CTA.
- [ ] Active reservation card surfaces date/time/party, action buttons (modify, cancel, directions, share, running late stub) with accessible labels.
- [ ] Favorites rail uses past/upcoming bookings to render at least 3 entries when available; discovery/perks sections render gracefully without data.
- [ ] Header/App nav + route docs reference `/dashboard`; `/guest` redirects to `/dashboard`.
- [ ] Bottom tab bar visible on mobile (<md) with Discover/Search/Reservations/Saved/Profile targets; a11y landmarks & keyboard navigation verified.

## Architecture & Components

- **Route**: `src/app/dashboard/page.tsx` (server) using `GuestLayout`; `dynamic = "force-dynamic"` to respect session.
- **Client**: `GuestDashboardClient` in `src/components/features/guest/dashboard/GuestDashboardClient.tsx` using `useBookings` (React Query) + derived selectors.
- **UI modules** (all Shadcn primitives):
  - `HeroBanner`: time-of-day greeting + CTA; states based on booking status/time.
  - `ActiveReservationCard`: displays nearest upcoming/live booking with actions (links to booking detail and map/directions placeholder).
  - `FavoritesRail`: derived restaurant frequency list; fallback empty state.
  - `DiscoveryFeed`: curated static cards (trending/collections/last-minute) with photo backgrounds.
  - `PerksCard`: loyalty/progress copy + badges.
  - `BottomTabNav`: sticky mobile nav reflecting IA.
- **Data helpers**: utility functions to pick `activeBooking`, `inProgressBooking`, `favoriteRestaurants` from `BookingDTO[]`.

## Data Flow & API Contracts

- Fetch bookings via `useBookings()` → `/api/bookings?me=1` (existing contract). No new APIs introduced.
- Links: `bookingDetailHref = /bookings/:id`; `modify/cancel` link to same detail; `share` uses `navigator.share` fallback copy to clipboard; `directions` placeholder uses restaurant slug if available (`/restaurants/:slug`) else disabled.

## UI/UX States

- Loading: skeletons for hero/active card rails.
- Empty bookings: hero shows hungry state CTA to discovery; active card replaced by prompt to explore tables; favorites section shows guidance.
- Error from bookings: display inline alert with retry (window reload) and still render static discovery/perks sections.

## Edge Cases

- Bookings without `restaurantSlug` → disable deep links and directions; fallback text only.
- Past-only bookings → hungry state; favorites still computed.
- Timezone unknown → use local browser time for comparisons; avoid overclaiming arrival times.
- Sharing unsupported → fallback to copy link button with toast.

## Testing Strategy

- Manual: load `/dashboard` authenticated, exercise CTAs (links, share fallback), keyboard tab order, focus ring visibility, responsive layout at 360px/768px/1280px using Chrome DevTools MCP.
- Functional sanity: ensure redirect to sign-in when logged out (via incognito session), bookings still load, rails visible.
- Accessibility: axe/ARIA via DevTools; ensure buttons have aria-labels; nav landmarks.

## Rollout

- No feature flag; direct release. Keep `/guest/bookings` intact; add redirect `/guest` → `/dashboard` to preserve legacy entry.
- Monitoring: rely on existing client error logs; no backend changes.

## DB Change Plan

- None.
