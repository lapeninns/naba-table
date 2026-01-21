---
task: fix-cls
timestamp_utc: 2026-01-21T13:55:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Reduce Cumulative Layout Shift (CLS)

## Requirements

- Functional:
  - Reduce layout shifts on initial load/hydration for representative routes.
- Non-functional (a11y, perf, security, privacy, i18n):
  - A11y: changes must not break keyboard navigation or labels.
  - Perf: avoid increasing JS bundle size; prefer CSS/HTML fixes and correct media sizing.
  - Security/privacy: no secrets in artifacts.

## Existing Patterns & Reuse

- Images:
  - Mixed usage: `next/image` is used in multiple marketing/profile components, but some guest/restaurant pages still use plain `<img>`.
  - `next/image` `fill` usage exists (requires stable parent sizing).
- Fonts:
  - Tailwind maps `fontFamily.sans` to `var(--font-sajilo)` (see `tailwind.config.js`).
  - Google Fonts `@import` is injected client-side for Inter/JetBrains Mono in `src/components/landing/FactoryHomeClient.tsx` (high CLS risk).
- A dev landing page existed at `src/app/dev/factory-landing/page.tsx` (used for CLS reproduction) and has been removed.
  - No font asset files (`.woff/.woff2/.ttf`) are present in repo for the declared "Nab a Table Cereal App" font family.

## External Resources

- Lighthouse CLS & Layout Shift debugging guidance (DevTools Performance).
- Next.js: `next/image` sizing and `next/font` fallback adjustment.

## Constraints & Risks

- CLS fixes often require UI/layout changes; must verify across mobile/desktop.
- Avoid broad refactors; focus on top offenders found via traces.

## Findings (baseline)

- Repro (historical): DevTools Performance trace on `http://localhost:3000/dev/factory-landing` showed CLS 0.16.
- DevTools `CLSCulprits` points to a network-loaded Inter font (`fonts.gstatic.com`) as the root cause.

## Suspected High-Impact Offenders (code)

- Fonts injected after hydration:
  - `src/components/landing/FactoryHomeClient.tsx` (`dangerouslySetInnerHTML` with `@import` Google Fonts)
- (Removed) `src/app/dev/factory-landing/page.tsx` (`@import` Google Fonts)
- Late-rendered banners that push content:
  - `src/components/features/booking-state-machine/BookingOfflineBanner.tsx` (rendered in `src/components/features/dashboard/OpsDashboardClient.tsx` and `src/components/features/bookings/OpsBookingsClient.tsx`)
  - `reserve/features/reservations/wizard/ui/WizardOfflineBanner.tsx` (rendered in `reserve/features/reservations/wizard/ui/BookingWizard.tsx`)
- Media without stable intrinsic sizing:
  - `src/components/restaurants/PublicSections.tsx` (plain `<img>` and inline `<svg>` missing explicit dimensions)
  - `src/components/landing/HomeSections.tsx` (prominent inline `<svg>` missing explicit dimensions)

## Open Questions (owner, due)

- Q: Which routes are highest priority for CLS? (guest landing vs ops dashboard vs booking details)
  A: UNCONFIRMED

## Recommended Direction (with rationale)

- Baseline CLS via Lighthouse and Performance trace; then address highest-impact causes first:
  - Ensure all images/media reserve space (explicit dimensions or stable aspect ratios).
  - Ensure async-loaded sections reserve height (skeleton/min-height) to prevent late pushes.
  - Ensure fonts use stable fallback adjustments to reduce FOIT/FOUT-induced shifts.
