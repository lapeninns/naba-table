---
task: guest-navbar-footer
timestamp_utc: 2025-12-04T11:05:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Guest Navbar & Footer Refresh

## Requirements

- **Functional**
  - Ensure guest-facing protected pages (`/guest/**`) share a consistent, auth-aware navbar and footer with clear routes to dashboard, bookings, profile, and reservation discovery.
  - Extend the same shell to public guest flows (e.g., marketing + booking entry under `(public)/(marketing)` and `(public)/bookings`) when appropriate, without breaking legacy fallbacks.
  - Preserve auth/session behaviour: sign-in/out links must respect Supabase session handling and current redirect logic.
- **Non-functional (a11y, perf, security, privacy, i18n)**
  - WCAG: visible focus, keyboard operable menus/drawers, skip-to-content, semantic landmarks, respect reduced motion, pointer targets ≥24px.citeturn1search1
  - Keep header/footer lightweight: avoid extra network calls beyond existing profile/session hooks; maintain mobile-first responsiveness (360–1440px) and prevent CLS.
  - No secrets or PII leakage; continue using existing auth/session providers and sign-out flows.

## Existing Patterns & Reuse

- `components/customer/navigation/CustomerNavbar.tsx` already implements a responsive guest navbar with primary links (`/browse`, `/reserve`), account menu, mobile sheet, and Supabase-aware sign-out.
- `components/layout/Footer.tsx` supports variants (`default|auth|app|marketing`) and a `guestUi` feature flag switch; current new-UI footer shows brand + “My bookings”/“Sign in”.
- Layouts consuming the shell:
  - `src/components/layouts/GuestLayout.tsx` (used by `/guest` and `(public)/bookings`) renders `Header variant="app"` + `Footer variant="app"` around a gradient background and `main#main-content` container.
  - `src/components/layouts/MarketingLayout.tsx` wraps `(public)/(marketing)` with `Header variant="marketing"` + `Footer variant="marketing"`; feature flag already switches between legacy and new gradient skin.
- Feature flag `env.featureFlags.guestUi` (default `true`) gates the new guest experience; `clientEnv.flags.guestUi` is used client-side in `Header` for styling toggles.

## External Resources

- W3C navigation guidance recommends providing clear landmarks and skip links so keyboard users bypass repeated content (navbar) efficiently.citeturn1search1
- Nielsen Norman Group notes mobile nav should keep primary actions visible and reduce deep menus to speed task completion—supports keeping a small set of top-level links.citeturn1search0

_MCP Context7/DeepWiki servers are unavailable (no resources listed), so web research was used instead to satisfy the investigation requirement._

## Constraints & Risks

- Swapping headers must not regress auth flows or Supabase session handling; `CustomerNavbar` relies on `useSupabaseSession` + `useProfile` so must stay within `AppProviders` scope.
- Need to keep legacy/ops areas untouched; restrict changes to guest + marketing layouts and keep legacy `Header` fallback for `guestUi=false`.
- Mobile drawer and dropdown a11y must remain compliant (focus trap, aria labels); ensure `main` elements include `id="main-content"` for skip links.
- Footer links should avoid implying access to protected pages when user is signed out; keep sign-out actions in header only.

## Open Questions

- Should marketing pages reuse the same customer navbar or stay minimal? (Assume align to reduce shell fragmentation.)
- Do we need a "Support" or "Contact" link in footer? (Assume not unless requested.)
- Should footer copy change for authenticated users (e.g., hide "Sign in")? (Assume yes—show auth-aware links.)

## Recommended Direction (with rationale)

- Use `CustomerNavbar` as the primary guest shell for both protected (`/guest/**`) and public guest routes when `guestUi` is enabled; keep `Header` as the legacy fallback.
- Update footers to be auth-aware and align link set with navbar (bookings/profile for signed-in users; browse/reserve/sign-in for signed-out), reusing the existing `Footer` component to avoid new primitives.
- Ensure layouts expose `main#main-content`, preserve gradients/backgrounds, and keep shell responsive across 360–1440px.
