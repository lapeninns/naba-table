# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Console & Network

- [ ] No Console errors (Failed: 500 errors observed)
- [ ] Network requests match contract (Failed: API returns 500)

### DOM & Accessibility

- [ ] Semantic HTML verified (Blocked: Page not loading)
- [ ] ARIA attributes correct (Blocked)
- [ ] Focus order logical & visible (Blocked)
- [ ] Keyboard-only flows succeed (Blocked)

### Performance (profiled; mobile; 4× CPU; 4G)

- FCP: N/A s | LCP: N/A s | CLS: N/A | TBT: N/A ms
- Budgets met: [ ] Yes [x] No (Page failed to load)

### Device Emulation

- [ ] Mobile (≈375px) [ ] Tablet (≈768px) [ ] Desktop (≥1280px)

## Test Outcomes

- [ ] Happy paths (Failed)
- [ ] Error handling (Verified: 500 error page shown)
- [ ] A11y (axe): 0 critical/serious (Blocked)

## Artifacts

- Lighthouse: N/A
- Network: `artifacts/network.har` (Not captured)
- Traces/Screens: `artifacts/` (Screenshots of failure captured)
- DB diff (if DB change): N/A

## Known Issues

- [x] Invalid API Key (Supabase) prevents loading restaurant pages and booking API.
- [x] `scripts/run-booking-flow.ts` was failing to load env vars (Fixed).

## Sign‑off

- [ ] Engineering
- [ ] Design/PM
- [ ] QA
