---
task: navbar-revamp
timestamp_utc: 2025-11-23T00:11:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Navbar Revamp

## Objective

We will redesign the customer navbar to be mobile-first, clearer, and more tactile so users can quickly browse/reserve, access their account, and navigate on any device without friction.

## Success Criteria

- [ ] Navbar remains sticky with a visible brand and CTA on both mobile and desktop.
- [ ] Mobile drawer groups primary links and account actions with clear hit areas (≥44px) and closes on navigation.
- [ ] Desktop layout has improved spacing/contrast and active-state clarity for primary links.
- [ ] A11y preserved: skip link works, focus states visible, aria-current/expanded correct; keyboard-only flows succeed.

## Architecture & Components

- `components/Header.tsx`: replace legacy flex nav with mobile-first layout, improved mobile drawer (Sheet), refined desktop nav/action cluster; reuse existing data hooks and Shadcn primitives.
- Style tokens from Tailwind/Shadcn; no new dependencies expected.

## Data Flow & API Contracts

- Reuse `useSupabaseSession` + `useProfile` for account snapshot; no API contract changes.
- Sign-out continues via `signOutFromSupabase` and router refresh.

## UI/UX States

- Loading: skeleton/avatar placeholder while profile loads.
- Authenticated: avatar dropdown (desktop) + account card/actions in drawer.
- Unauthenticated: sign-in CTA; primary links always visible.
- Mobile: sheet with sections (Explore, Account), optional CTA.

## Edge Cases

- Pathname undefined during SSR/hydration; guard active state checks.
- Missing profile metadata; fall back to email initials and "Account" label.
- Sign-out in progress disables actions to avoid double submissions.

## Testing Strategy

- Manual: keyboard navigation, skip-to-content, focus rings, tab through dropdown + drawer, mobile viewport toggling.
- Visual: confirm active states on each primary link and CTA prominence on desktop/mobile.
- Regression: verify drawer closes on route change and sign-out still redirects home.

## Rollout

- No feature flag; ship directly with visual verification. If issues arise, revert the component file.

## DB Change Plan (if applicable)

- N/A (UI-only).
