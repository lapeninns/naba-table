---
task: guest-navbar-footer
timestamp_utc: 2025-12-04T11:08:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Guest Navbar & Footer Refresh

## Objective

Give guest-facing pages a consistent, modern navbar and footer that work for both protected guest routes and public guest flows while keeping the legacy shell available behind the existing `guestUi` flag.

## Success Criteria

- [ ] `CustomerNavbar` replaces the legacy header for guest layouts when `guestUi` is on; legacy header remains for `guestUi` off.
- [ ] Footer shows auth-aware links (bookings/profile for signed-in; browse/reserve/sign-in for logged-out) and matches the new UI styling.
- [ ] Skip-to-content target exists (`#main-content`) on updated layouts; keyboard navigation and focus states verified on mobile + desktop widths.
- [ ] No regressions to auth/session handling (sign-out redirects correctly, no double fetches); layout remains responsive at 360/768/1280+ px.

## Architecture & Components

- **Layout switch**: Update `src/components/layouts/GuestLayout.tsx` to render `CustomerNavbar` when `env.featureFlags.guestUi` is true; otherwise keep `Header variant="app"`. Ensure `main` retains `id="main-content"` and container spacing aligns with navbar width.
- **Footer enhancements**: Extend `components/layout/Footer.tsx` to compute link sets based on auth state and variant, reusing existing styling branches; keep fallback legacy UI when `guestUi` is false.
- **Skip link support**: Add `id="main-content"` to marketing layout main so the global skip link works on public routes that share the new shell.
- **State handling**: Reuse `useSupabaseSession` + `useProfile` already used by `CustomerNavbar`; no new APIs.

## Data Flow & Contracts

- Navbar uses existing session from `SupabaseSessionProvider` and profile query via `useProfile`; sign-out uses `signOutFromSupabase` helper. No new endpoints or payload changes.

## UI/UX States

- **Auth states**: loading (skeleton), unauthenticated (sign-in + primary CTAs), authenticated (avatar menu + account links).
- **Responsive**: sticky navbar with mobile sheet; footer stacks on mobile and inlines links on desktop.
- **Accessibility**: focus-visible rings on interactive elements; `aria-*` preserved on dropdown/sheet triggers; skip link lands on `main#main-content`.

## Edge Cases

- Session loading/no profile available should still render nav without flicker.
- Mobile drawer closes after navigation and after sign-out.
- Legacy mode (`guestUi=false`) should render exactly the previous header/footer.

## Testing Strategy

- Manual QA via Chrome DevTools MCP:
  - Logged-out view on `/guest/thank-you` (uses `GuestLayout`) at 360px/768px/1280px for header/footer behaviour, keyboard navigation, and focus rings.
  - Marketing landing `/` to confirm skip-link target exists and footer layout unaffected.
- Basic lint/format if touched files drift.

## Rollout

- Behind existing `guestUi` flag (default true). No new flags.
- No database or API changes; deploy with standard frontend release.
