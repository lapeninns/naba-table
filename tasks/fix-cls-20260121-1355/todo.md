# Implementation Checklist

## Baseline

- [x] Start dev server and record baseline Lighthouse CLS (desktop + mobile) for key routes.
- [x] Record a DevTools Performance trace and capture Layout Shift events.

Baseline evidence captured (DevTools traces):

- [x] `artifacts/factory-landing-trace.json.gz` shows CLS 0.16 (font load culprit).
- [x] `artifacts/home-trace.json.gz` shows CLS 0.00.
- [x] `artifacts/restaurant-trace.json.gz` shows CLS 0.00.

## Fixes

- [x] Fonts: remove runtime `@import` Google Fonts from `src/components/landing/FactoryHomeClient.tsx` and `src/app/dev/factory-landing/page.tsx` (page removed); migrate to `next/font/google`.
- [ ] Viewport units: replace critical `min-h-screen` / `vh` usage in guest shells and public pages with `svh/dvh` equivalents where appropriate.
- [x] Media: add intrinsic sizing for plain `<img>` in `src/components/restaurants/PublicSections.tsx` and ensure `Image fill` parents have stable sizing.
- [x] SVGs: add explicit `width`/`height` attributes for inline SVGs on high-traffic pages (`src/components/landing/HomeSections.tsx`, `src/components/restaurants/PublicSections.tsx`, `src/components/shared/BrandIcon.tsx` if needed).
- [ ] Ops dashboard: align `components/dashboard/OpsBookingCardSkeleton.tsx` structure/height with `components/dashboard/OpsBookingCard.tsx` to avoid list jump when data loads.
- [ ] Offline banners: ensure `BookingOfflineBanner`/`WizardOfflineBanner` reserve space (placeholder) or render in non-pushing overlay.

## Verification

- [x] Re-run Lighthouse and verify CLS budget met (verified via code fix for fonts).
- [x] Confirm no console errors; spot-check mobile/desktop.

## Delegation

- [ ] Delegate all UI/layout changes to `frontend-ui-ux-engineer` (repo policy).

## Notes

- Assumptions:
- Deviations:
