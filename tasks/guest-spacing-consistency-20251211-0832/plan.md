---
task: guest-spacing-consistency
timestamp_utc: 2025-12-11T08:45:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Guest Spacing Consistency

## Objective

Ensure every guest-facing surface (marketing landing, auth, guest portal layouts/navbars) applies the same mobile-first padding and margin rhythm defined in the guest spacing scale so edges align precisely without stacked gutters.

## Success Criteria

- [ ] A shared container utility guarantees identical horizontal padding (with safe-area compensation) across navbars, layouts, and sections.
- [ ] Guest and auth layouts no longer double-apply `px-*` classes yet maintain ≥32px vertical breathing room.
- [ ] Landing sections (`FactoryHomeClient`) and navbars align with the same container width on mobile, eliminating visible misalignment.
- [ ] Chrome DevTools MCP run on `/`, `/auth/signin`, `/guest/dashboard` (or representative page) shows no layout shifts and consistent gutters.

## Architecture & Components

- `src/app/globals.css`
  - Add a `.guest-boundary` utility that encapsulates the `guest-page` horizontal constraints plus safe-area padding via `env()` so components can opt into consistent gutters without inheriting block padding.
  - Update `.guest-page` to internally use the same safe-area aware values to avoid divergence.

- `src/components/layouts/GuestLayout.tsx`
  - Replace the nested `container-default px-*` wrapper with `.guest-boundary` so page content inherits the standardized gutters.
  - Explicitly manage top/bottom padding on `<main>` to maintain existing breathing room without stacking.

- `src/components/layouts/AuthLayout.tsx`
  - Mirror the above change; wrap the centered content in `.guest-boundary` and limit width via utility classes rather than raw `px-4`.

- `src/components/layouts/GuestNavbar.tsx` & `src/components/layouts/AuthNavbar.tsx`
  - Swap bespoke `max-w-* px-*` shells for `.guest-boundary` wrappers; ensure mobile sheet padding remains 24px per spec.
  - Reuse the shared spacing scale for inline gaps (e.g., `gap-4` vs absolute `px-5`).

- `src/components/landing/FactoryHomeClient.tsx`
  - Update `SECTION_CONTAINER`, navbar, CTA, and footer wrappers to use `.guest-boundary` (and remove redundant `px-5 sm:px-6`).
  - Review hero/section padding so vertical rhythm is expressed via a single `SECTION_SPACING` constant (clamped for small screens) to prevent stacking.

## Data Flow & API Contracts

- No data changes; purely presentational. Ensure `ImplicitAuthHandler` and Supabase hooks remain untouched while moving wrappers.

## UI/UX States

- Loading/error flows unaffected. Confirm nav skip links still land on `#main-content` even if structural wrappers change.

## Edge Cases

- Safe area insets (iPhone notch) should now be accounted for via `env()`. Verify no overflow/scrollbars introduced on devices without safe areas.
- Ensure `.guest-boundary` is not applied multiple times in nested contexts to avoid shrinking width repeatedly.

## Testing Strategy

1. `pnpm run lint` — ensure updated CSS/TSX pass linting.
2. `pnpm run test -- --runInBand src/tests/server/homepage-redirect.test.tsx` (or full `pnpm run test`) to confirm route-level expectations still pass.
3. Manual QA: Use Chrome DevTools MCP to load `/`, `/auth/signin`, `/guest/dashboard` on mobile emulation (~375px) and desktop, capturing before/after screenshots and verifying gutters align with navbars.

## Rollout

- Pure frontend change; no feature flags required. Merge normally after verification artifacts (screenshots, Lighthouse) are attached in `verification.md`.
