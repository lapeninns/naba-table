---
task: guest-dashboard-home
timestamp_utc: 2025-11-23T19:06:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Guest Dashboard Home

## Requirements

- Home page for guest-facing experience should live at `/dashboard`; treat this as the default entry after sign-in.
- Dashboard needs to blend utility (reservations management) with discovery/loyalty inspiration per product brief.
- Key modules: contextual hero (hungry/upcoming/live), active reservation card with quick actions (modify, cancel, directions, share, running late), favorites "eat it again" rail, discovery feed (curated/trending/last-minute), loyalty & perks, and mobile bottom tab bar.
- Maintain accessibility (keyboard flow, focus, semantic landmarks) and responsive layout (mobile-first with visual richness).

## Existing Patterns & Reuse

- Guest shell uses `GuestLayout` (`src/components/layouts/GuestLayout.tsx`) which pulls `Header`/`Footer` with CTA + nav; we can reuse but need to update nav targets for the new dashboard path.
- Authentication pattern for guest pages: server components check Supabase session and redirect to `/auth/signin?redirectedFrom=<path>` (see `src/app/guest/bookings/page.tsx`).
- Data: `useBookings` hook (React Query) fetches `/api/bookings?me=1` and returns `BookingDTO` list; `BookingListClient` shows usage and status handling.
- UI kit: Shadcn components in `components/ui` (card, badge, button, tabs, avatar, sheet, etc.), utility `cn` helper. Marketing imagery already whitelists `images.unsplash.com` in `next.config.js`.
- Navigation doc `guest-facing-routes.md` currently marks `/guest` as guest dashboard and `/guest/bookings` as list; will need alignment.

## Constraints & Risks

- Must honor AGENTS: task artifacts, a11y baseline, Shadcn-first, no secrets, manual Chrome DevTools QA for UI changes.
- No live discovery/loyalty APIs exist; discovery/favorites/perks will rely on derived bookings data + curated placeholders. Need to keep copy explicit about sample nature and keep data structures easy to swap.
- Timezone/availability accuracy depends on booking data; minimal computation should avoid misleading precision.
- Ensure redirects do not break existing `/guest/bookings` deep links; preserve compatibility by redirecting `/guest` to `/dashboard`.

## Open Questions (owner, due)

- Do we have real-time availability/feed APIs for "Tables available now"? (owner: product, due: later) — proceed with curated static set for now.
- Should "Running late" trigger a real API/notification? (owner: eng, due: later) — provide stub CTA linking to booking detail for now.

## Recommended Direction (with rationale)

- Create `/dashboard` route using `GuestLayout`; server-side gate with Supabase session + redirect for unauthenticated users.
- Build `GuestDashboardClient` (client component) that consumes `useBookings`, derives hero state (hungry/upcoming/live), identifies nearest active reservation, and computes favorites from booking history.
- Add visually rich sections using Shadcn `Card`, gradients, and media with mobile-first stacking; include horizontal rails for favorites/discovery and a sticky bottom tab bar on mobile for IA outlined in the brief.
- Update header nav/CTA and `guest-facing-routes.md` to reflect `/dashboard` as canonical guest home while keeping existing `/guest/bookings` route intact.
