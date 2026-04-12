---
task: guest-style-preset-migration
timestamp_utc: 2026-04-11T17:36:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Console & Network

- [ ] No Console errors
- [x] Network requests match contract
- Verified `/` and `/site-map` in mobile emulation with no console warnings/errors.
- Verified `/site-map` in tablet emulation with no console warnings/errors.
- Verified `/restaurants` in desktop emulation and observed one existing hydration mismatch in the restaurant grid; no failed network requests were observed during the guest-style checks.

### DOM & Accessibility

- [x] Semantic HTML verified
- [x] ARIA attributes correct
- [x] Focus order logical & visible
- [x] Keyboard-only flows succeed
- Checked landmark structure, navigation labels, and footer/link accessibility on `/site-map`.

### Performance (profiled; mobile; 4× CPU; 4G)

- Lighthouse navigation audit on `/site-map` (mobile):
  - Accessibility: 96
  - Best Practices: 100
  - SEO: 92
- Lighthouse snapshot audit on `/restaurants` (desktop):
  - Accessibility: 96
  - Best Practices: 100
  - SEO: 83
- Note: Chrome DevTools performance trace unexpectedly captured `/privacy` instead of the selected guest page, so this task relies on Lighthouse plus manual interaction checks for guest-surface validation.

### Device Emulation

- [x] Mobile (≈375px)
- [x] Tablet (≈768px)
- [x] Desktop (≥1280px)

## Test Outcomes

- [x] `pnpm exec vitest run tests/app/guest-facing-pages.test.ts`
- [x] `pnpm exec eslint src/components/layouts/GuestLayout.tsx src/components/layouts/MarketingLayout.tsx src/components/layouts/GuestBackground.tsx src/components/layouts/GuestNavbar.tsx src/components/layouts/Footer.tsx src/components/layouts/guest-font.ts src/components/landing/shared/Navbar.tsx src/components/landing/shared/Footer.tsx src/components/landing/sections/HeroSection.tsx src/components/landing/sections/ProblemSection.tsx src/components/landing/sections/CTASection.tsx src/components/shared/BrandLogo.tsx 'src/app/(public)/(marketing)/site-map/page.tsx'`
- [x] `pnpm typecheck`

## Artifacts

- Mobile screenshots:
  - `artifacts/home-mobile.png`
  - `artifacts/site-map-mobile.png`
- Desktop screenshot:
  - `artifacts/restaurants-desktop.png`
- Lighthouse:
  - `artifacts/lighthouse-site-map-mobile/report.json`
  - `artifacts/lighthouse-site-map-mobile/report.html`
  - `artifacts/lighthouse-restaurants/report.json`
  - `artifacts/lighthouse-restaurants/report.html`
- Trace artifact captured during investigation:
  - `artifacts/site-map-mobile-trace.json`

## Known Issues

- `shadcn info` currently resolves to root-level `/components` and `/app/globals.css` instead of active `src/` paths.
- The exact requested shadcn monorepo reinstall flow is incompatible with this repo layout because `packages/ui/components.json` does not exist.
- `/restaurants` currently logs a hydration mismatch in local dev inside the restaurant grid. This appeared during verification and was not introduced by the guest-only wrapper/theme changes in this task.

## Sign-off

- [x] Engineering
- [ ] Design/PM
- [x] QA
