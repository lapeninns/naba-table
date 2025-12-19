---
task: navbar-revamp
timestamp_utc: 2025-12-04T15:02:42Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Navbar Revamp

## Requirements

- Functional:
  - Single, session-aware navbar used across all guest-facing routes (public home, marketing pages, `/guest/**`, `/bookings/**`, auth screens).
  - Navbar exposes only two visual states: **unauthenticated** (public) and **authenticated** (protected) while keeping IA/CTA consistent.
  - Remove duplicate CTAs/labels and avoid rendering multiple nav shells on the same page.
  - Preserve responsive behavior (mobile drawer + desktop bar) and highlight current route.
- Non-functional (a11y, perf, security, privacy, i18n):
  - WCAG-compliant focus management, skip-link, and ARIA labels for menus/drawers.
  - Sticky top without causing CLS; reuse Shadcn primitives; minimal client bundle changes.
  - Auth-aware flows must not leak session info; sign-out clears cached queries as today.

## Existing Patterns & Reuse

- `components/customer/navigation/CustomerNavbar.tsx` — current guest navbar (feature-flagged via `guestUi`) with session + profile hydration, mobile sheet, account dropdown, sign-out + query cache clear.
- `components/layout/Header/Header.tsx` — legacy/shared header with variants (`marketing`, `app`, `auth`); used by `MarketingLayout`, `AuthLayout`, and as fallback in `GuestLayout` when `guestUi` is false.
- Layouts:
  - `src/components/layouts/GuestLayout.tsx` toggles between `CustomerNavbar` and `Header` via `env.featureFlags.guestUi`.
  - `src/components/layouts/MarketingLayout.tsx` always uses `Header variant="marketing"` (flag only alters styling tone).
  - `src/components/layouts/AuthLayout.tsx` uses `Header variant="auth"`.
  - Public home (`src/app/(public)/page.tsx`) currently has **no navbar** wrapper.
- Session plumbing: `hooks/useSupabaseSession.tsx` (statuses `loading|authenticated|unauthenticated`) fed by `AppProviders` initial session from `src/app/layout.tsx`.
- CTA logic elsewhere (`components/marketing/MarketingSessionActions.tsx`) already uses session to swap CTAs—good reference for action copy.

## External Resources

- None yet (all context from repo).

## Constraints & Risks

- Must obey root + components AGENTS: accessibility, Shadcn-first primitives, manual DevTools MCP QA for UI changes.
- Need to avoid breaking ops/owner surfaces; scope limited to guest-facing route groups.
- Session-handling must continue to clear React Query cache on sign-out and avoid hydration flicker.
- Different backgrounds (light marketing vs dark gradient) require nav tokens that work on both without duplicating variants.
- Feature flag `guestUi` currently defaults to `true`; need a transition strategy if we replace both navs.

## Open Questions (owner: @assistant, due: before implementation)

- IA confirmed: keep `Restaurants` as the only top-level link; put Dashboard/Bookings/Profile inside the account menu when authenticated.
- CTA copy: standardize on "Reserve a table" for all states.
- Auth pages: use the same navbar (no slim variant).
- Stickiness: keep sticky across guest routes unless layout opts out.
- guestUi flag: remove the flag; ship unified navbar without feature gating.

## Recommended Direction (with rationale)

- Build a single `GuestNavbar` (client) that consumes `useSupabaseSession` + `useProfile` for avatar/name and exposes two states (unauthenticated vs authenticated) while keeping IA identical.
- Standardize link + CTA config in one place (embedded in the component) to eliminate divergent labels between `Header` and `CustomerNavbar`.
- Replace navbar usage in `GuestLayout`, `MarketingLayout`, `AuthLayout`, `(public)` home, and any marketing exports with the unified component; remove legacy `Header`/`CustomerNavbar` and the `guestUi` flag.
- Preserve existing sign-out behavior (query cache clear + redirect) and reuse Shadcn Sheet/Dropdown components for responsive behavior and a11y.
