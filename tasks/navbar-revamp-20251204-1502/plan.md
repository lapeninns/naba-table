---
task: navbar-revamp
timestamp_utc: 2025-12-04T15:02:42Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Navbar Revamp

## Objective

Deliver a single, session-aware guest navbar that appears on all guest-facing routes (public, marketing, auth, and `/guest/**`) with only two visual states (authenticated vs unauthenticated) and no duplicated CTAs or shells.

## Success Criteria

- [ ] All guest-facing layouts render the same navbar component with identical IA/CTA (only auth state changes).
- [ ] Navbar reflects Supabase session accurately: correct account menu when logged in; Sign in/Book CTA when logged out.
- [ ] A11y/perf: keyboard-only navigation works (skip link, focus rings), no CLS on page load, no console errors in DevTools QA.

## Architecture & Components

- New client component `GuestNavbar` (proposed path: `src/components/layouts/GuestNavbar.tsx`) built on Shadcn primitives (Sheet, Dropdown, Button, Avatar) and existing hooks `useSupabaseSession` + `useProfile` for display name/avatar.
- Shared config module `navConfig.ts` to define IA/CTAs for `public` vs `authenticated` state (links, labels, aria labels); single source of truth for both desktop pills and mobile drawer.
- Sign-out uses existing `signOutFromSupabase` + query cache clear (`buildQueryStorageKey`/`clearPersistedQueryCache`) to preserve behavior from `CustomerNavbar`/`Header`.
- Prop-driven tone support (e.g., `tone="light" | "dark"`) so marketing gradients and light guest pages use the same component without branching variants.
- Optional `isSticky` prop to control sticky positioning per layout if needed (default on); avoid duplicate wrappers.

## Data Flow & API Contracts

- No new APIs. Reads Supabase session via `useSupabaseSession` (already hydrated by `AppProviders`).
- Optional profile fetch via `useProfile` to surface name/avatar; fall back to metadata/email initials.
- Sign-out reuses `signOutFromSupabase` + router redirect to `/`.

## UI/UX States

- Loading: skeleton for avatar/account trigger while session/profile hydrate; nav links + CTA stay interactive.
- Unauthenticated: brand + primary link (`Restaurants`), primary CTA (e.g., `Reserve a table`), secondary `Sign in` button; mobile drawer mirrors desktop.
- Authenticated: brand + primary link; account dropdown with `Dashboard`, `My bookings`, `Profile`, `Sign out`; primary CTA becomes `Book again`/`Reserve` (consistent copy TBD).
- Mobile: sheet with Explore links + Account actions; desktop: pill nav + CTA + avatar dropdown.

## Edge Cases

- Missing profile image/name → derive initials from email; keep fallback avatar.
- Unknown path → no pill highlighted; ensure aria-current only when exact match/prefix.
- Sign-out failures should show toast and keep drawer open/closed state sane.
- Support SSR hydration: avoid flicker between states by honoring initial session and rendering neutral/loading skeleton.

## Testing Strategy

- Unit/RTL: minimal smoke for nav config selection and sign-out handler invocation (optional if time allows).
- Manual QA (DevTools MCP required): keyboard-only traversal, focus rings, skip link, mobile drawer open/close, account dropdown; check console/network.
- Cross-route spot checks: `/`, `/restaurants`, `/guest/dashboard`, `/guest/bookings`, `/auth/signin`.

## Rollout

- Replace legacy `CustomerNavbar`/`Header` everywhere on guest surfaces; remove `guestUi` flag usage entirely.
- Full rollout (no flag). Quick revert path is git revert if needed.
- Monitoring: spot-check Supabase auth events and client console errors post-deploy.

## DB Change Plan (if applicable)

- Not applicable (UI-only change; no DB migrations).
