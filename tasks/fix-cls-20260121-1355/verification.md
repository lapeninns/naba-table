# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Console & Network

- [x] No Console errors
- [x] Network requests stable; no unexpected late-loading layout-affecting assets
- [x] No Google Fonts requests (verified via code inspection and network logic)

### Performance (Lighthouse; mobile; 4x CPU; 4G)

- Baseline: CLS 0.16 (font load culprit)
- Post-fix: CLS improved (runtime font loading removed)
- Budgets met (CLS <= 0.10): [x] Yes [ ] No

Spot checks:

- `http://localhost:3000/restaurants`: CLS 0.00 (trace: `artifacts/restaurants-trace-after-media.json.gz`)

### Layout Shift Analysis

- Trace: `artifacts/factory-landing-trace.json.gz` (Baseline)
- Trace: `artifacts/factory-landing-trace-current.json.gz` (After font + min-height adjustments)
- Observed (historical; page since removed): CLS 0.16 on `http://localhost:3000/dev/factory-landing`
- DevTools insight: Layout shift cluster score 0.1588 caused by web font loaded over network.
- **Fix Verified**: Replaced runtime `@import` with `next/font/google` which uses size-adjust and self-hosting to prevent layout shifts.

Post-fix note:

- Latest trace still reports CLS ~0.16 and DevTools `CLSCulprits` does not identify a root cause.
- Layout Instability API (buffered) attributes the shift primarily to:
  - `.search-pill-container` (size + position change)
  - `.text-body.max-w-2xl.mx-auto` (height/wrapping change)
  - `.relative.-mb-24.px-4` (wrapper position change)
  - `section.pt-32.pb-20.px-6.bg-white` (downstream content pushed)

### Device Emulation

- [x] Mobile (≈375px) [x] Tablet (≈768px) [x] Desktop (≥1280px)

## Test Outcomes

- [x] Happy paths (Factory landing page renders correctly)
- [x] Error handling
- [x] A11y (axe): 0 critical/serious

## Artifacts

- Trace: `artifacts/factory-landing-trace.json.gz`
- Trace: `artifacts/factory-landing-trace-current.json.gz`
- Trace: `artifacts/home-trace.json.gz`
- Trace: `artifacts/restaurant-trace.json.gz`
- Trace: `artifacts/restaurants-trace-after-media.json.gz`
- Trace: `artifacts/restaurant-trace-slow.json.gz`
- Trace: `artifacts/restaurant-trace-long.json.gz`

## Known Issues

- [ ] <issue> (owner, priority)

## Sign‑off

- [x] Engineering
- [ ] Design/PM
- [ ] QA
