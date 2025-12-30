---
task: floor-plan-revamp
timestamp_utc: 2025-12-30T17:42:41Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Console & Network

- [x] No Console errors (only the Supabase warning about auth payload authenticity appeared).
- [x] Network requests match contract (data calls to `/api/ops/zones`, `/api/ops/tables`, `/api/ops/bookings`, etc. returned 200 while navigating from the floor plan to the bookings page).

Notes: Floor plan and bookings loads remained stable; the only console output of note was the Supabase auth warning that already exists in this project.

### DOM & Accessibility

- [x] Semantic HTML verified via Shadcn cards/sections with headings and structured content.
- [x] ARIA attributes correct (ToggleGroup has `aria-label`, buttons expose accessible names, slider is labeled, Sheet provides modal semantics).
- [x] Focus order logical & visible (tabbing through the toolbar, canvas, and inspector keeps focus rings visible and predictable).
- [x] Keyboard-only flows succeed (table tiles, Add/Browse actions, and inspector buttons are reachable via Tab/Enter).

### Performance (profiled; mobile; 4× CPU; 4G)

- FCP: not measured (pending Lighthouse run)
- LCP: not measured (pending Lighthouse run)
- CLS: not measured (pending Lighthouse run)
- TBT: not measured (pending Lighthouse run)
- Budgets met: [ ] Yes [x] No (notes: automated Lighthouse metrics still pending, will collect during next verification pass)

### Device Emulation

- [x] Mobile (≈375px) – layout/sheet verified (`artifacts/devtools-floor-plan-mobile.png`).
- [x] Tablet (≈768px) – layout adapts with inline inspector (`artifacts/devtools-floor-plan-tablet.png`).
- [x] Desktop (≥1280px) – default view with side inspector & floor canvas (`artifacts/devtools-floor-plan.png`).

## Test Outcomes

- [x] Happy paths (floor plan renders, inspector actions work, Browse Bookings reroutes to `/bookings` with date/table/time parameters; new booking launches `/new-bookings` with date/time/party-size context).
- [ ] Error handling (not exhaustively exercised).
- [ ] A11y (axe): 0 critical/serious (not run yet).

Notes: `pnpm lint` fails locally because ESLint reports it cannot resolve plugin `react-hooks` for the rule `react-hooks/preserve-manual-memoization` even though `eslint-plugin-react-hooks` is installed (see test output below). This will need investigation/separate fix.

## Artifacts

- Lighthouse: `artifacts/lighthouse-report.json` (not collected yet)
- Network: `artifacts/network.har` (not collected yet)
- Traces/Screens:
  - `artifacts/devtools-floor-plan.png`
  - `artifacts/devtools-floor-plan-mobile.png`
  - `artifacts/devtools-floor-plan-tablet.png`
  - `artifacts/devtools-floor-plan-error.png` (initial auth-blocked capture)
- JSON dump: `floor-plan-frontend.json` (consolidated FloorPlanPage code in JSON)
- DB diff (if DB change): `artifacts/db-diff.txt` (N/A)

## Known Issues

- [ ] DevTools QA performance metrics still pending (run Lighthouse at 4× CPU/4G to capture FCP/LCP/CLS/TBT).
- [ ] ESLint `react-hooks/preserve-manual-memoization` rule fails: plugin `react-hooks` cannot be resolved even though it exists in node_modules (see `pnpm lint` output).

## Sign-off

- [ ] Engineering
- [ ] Design/PM
- [ ] QA
