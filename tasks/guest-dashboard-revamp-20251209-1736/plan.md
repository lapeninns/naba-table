---
task: guest-dashboard-revamp
timestamp_utc: 2025-12-09T17:36:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Guest Dashboard Revamp

## Objective

Refresh the guest dashboard (/guest/dashboard) with the shared Design System tokens so guests immediately see their next booking, quick actions, and favorites in a consistent, mobile-first layout while keeping existing data flows intact.

## Success Criteria

- [ ] Above-the-fold hero shows greeting plus primary booking/CTA using `heading-*`, `text-body`, `shadow-card` / radius tokens from `DesignSystem.md`.
- [ ] Quick actions, upcoming list, and favorites use unified card/button styles and remain fully keyboard accessible (focus-visible, semantic headings/lists).
- [ ] Empty/loading/error states preserved with layout-stable skeletons; no layout shift when data loads.
- [ ] Mobile (≤768px) renders single-column stack; desktop (≥1024px) uses two-column grid without overflow.

## Architecture & Components

- `src/components/features/guest/dashboard/GuestDashboardClient.tsx`
  - Recompose layout using `GuestSection` + design-system utility classes (heading/text/shadow-card, radius vars).
  - Add small `Highlights` row (count chips) leveraging `Badge`/inline tokens with data from `derived.total`, `upcomingList.length`, `derived.favorites.length`.
  - Redesign `FeaturedBooking` card to use design tokens (muted surface, border, `shadow-card`, toned gradients), keeping CTA buttons, QR dialog, and share/directions logic.
  - Update QuickAction cards to align with design-system pill style (`shadow-card`, rounded-full buttons, consistent icon sizing).
  - Refine Upcoming/Favorites rows to match tokens (text sizes, spacing, focusable links); keep existing data logic and empty states.
- No changes to server routes/view model needed; keep `GuestDashboardPage` composition unchanged.

## Data Flow & API Contracts

- Inputs remain `useGuestBookings`, `useGuestProfile`, `useGuestSession`; no new API calls.
- Derived state stays in `deriveBookingState` / `upcomingList`; add local `stats` derived from existing data only.
- Actions/links unchanged: booking detail (`/guest/bookings/[id]`), history tab, profile, favorites, share/directions URLs.

## UI/UX States

- Loading: existing skeletons retained but resized to new card shapes.
- Empty: `GuestEmpty` for no bookings/favorites; CTA to `/`.
- Error: reuse `GuestError` within `StatusRegion`.
- Success: hero + featured booking (or blank state) + quick actions + lists.

## Edge Cases

- No bookings: show design-system styled blank featured card with “Find a table” CTA.
- Live booking today vs future: badge colors switch without flashing; handle missing timezone gracefully.
- No favorites: keep empty state; avoid undefined slug links.
- Sharing fallback when `navigator.share` unavailable; clipboard copy still toasts.

## Testing Strategy

- Unit/logic: rely on existing hook/derivation coverage; spot-check by running `pnpm lint` and, if time permits, `pnpm test --filter guest` or equivalent (none new expected).
- Manual QA (Chrome DevTools MCP required):
  - Keyboard navigation across hero CTA, quick actions, list rows, dialogs.
  - Mobile (≈375px) and desktop (≥1280px) layout checks.
  - Lighthouse/a11y snapshot for `/guest/dashboard`; capture HAR/screenshot to `artifacts/`.

## Rollout

- No feature flag; ships with next deploy.
- Kill-switch: revert component file or deploy rollback.
- Monitoring: rely on existing error boundary and Sentry/logging (unchanged).
