---
task: guest-facing-pages-directory
timestamp_utc: 2026-04-11T17:26:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Console & Network

- [x] No Console errors
- [x] Network requests match contract

### DOM & Accessibility

- [x] Semantic HTML verified
- [x] ARIA attributes correct
- [x] Focus order logical & visible
- [x] Keyboard-only flows succeed

### Performance (profiled; mobile; 4× CPU; 4G)

- Trace summary (mobile emulation, no throttling): LCP 0.117 s | CLS 0.00
- Lighthouse snapshot: Accessibility 100 | Best Practices 100 | SEO 83
- FCP/TBT: not surfaced by the snapshot + trace summary flow used here
- Budgets met: [x] Yes [ ] No (notes: measured values are comfortably under budget; one unrelated SEO warning remains for the repo-level `robots.txt`.)

### Device Emulation

- [x] Mobile (≈375px)
- [ ] Tablet (≈768px)
- [x] Desktop (≥1280px)

## Test Outcomes

- [x] Targeted unit tests — `pnpm vitest run tests/app/guest-facing-pages.test.ts`
- [x] Type safety — `pnpm typecheck`
- [x] Targeted lint — `pnpm exec eslint 'src/app/guest-facing-pages.ts' 'src/app/(public)/(marketing)/site-map/page.tsx' 'src/app/sitemap.ts' 'src/components/layouts/Footer.tsx' 'src/components/landing/shared/Footer.tsx' 'tests/app/guest-facing-pages.test.ts'`

## Artifacts

- Desktop screenshot: `artifacts/site-map-desktop.png`
- Mobile screenshot: `artifacts/site-map-mobile.png`
- Lighthouse JSON: `artifacts/report.json`
- Lighthouse HTML: `artifacts/report.html`
- Performance trace: `artifacts/site-map-trace.json`

## Known Issues

- Lighthouse reports `robots.txt is not valid`, which appears to be a pre-existing repo-level SEO issue unrelated to the new `/site-map` route.

## Sign-off

- [x] Engineering
- [ ] Design/PM
- [ ] QA
