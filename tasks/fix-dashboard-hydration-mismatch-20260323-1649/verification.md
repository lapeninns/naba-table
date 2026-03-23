---
task: fix-dashboard-hydration-mismatch
timestamp_utc: 2026-03-23T16:49:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

Environment:

- Verified on `http://127.0.0.1:3202/dev/ops-dashboard`
- Temporary QA workspace: `/tmp/nabatableLP-hydration-qa`
- Reason: primary workspace runs with `APP_ENV=staging`, so `enforceDevOnly()` blocks the dashboard harness there.

### Console & Network

- [x] No console hydration errors on dashboard
- [x] Network requests match contract
- Notes:
  - Reloaded the dashboard harness and confirmed no React hydration mismatch errors.
  - All local dashboard assets returned `200`.
  - Existing non-blocking console noise remains from unrelated areas:
    - form field `id`/`name` issues
    - `Multiple GoTrueClient instances detected`
    - PostHog debug logging

### DOM & Accessibility

- [x] Semantic HTML verified
- [x] ARIA attributes correct
- [x] Focus order logical & visible
- [x] Keyboard-only flows succeed

### Performance (profiled; mobile; 4× CPU; 4G)

- LCP: 0.389 s
- CLS: 0.00
- TTFB: 0.315 s
- FCP: not captured by the DevTools trace summary
- TBT: not captured by the DevTools trace summary
- Lighthouse snapshot:
  - Accessibility: 96
  - Best Practices: 100
  - SEO: 80
- Budgets met: [x] Yes [ ] No
- Notes:
  - Load trace executed on the dev harness without CPU/network throttling.
  - The fix is hydration-focused; no perf regressions observed.

### Device Emulation

- [x] Mobile (≈375px)
- [x] Tablet (≈768px)
- [x] Desktop (≥1280px)

## Test Outcomes

- [x] Focused lint/type checks passed
- [x] Happy path verified
- [x] Error handling verified
- Commands:
  - `pnpm exec eslint --max-warnings=0 "src/app/app/(app)/dashboard/page.tsx" "src/app/(public)/dev/ops-dashboard/ui/OpsDashboardDevHarness.tsx" "src/components/features/dashboard/OpsDashboardClient.tsx" "src/components/features/dashboard/OpsDashboardHeader.tsx" "src/components/features/dashboard/ConnectionStatusBeacon.tsx" "src/components/features/dashboard/OpsDashboardSummarySection.tsx" "src/components/features/dashboard/DashboardSummaryCard.tsx" "src/components/features/dashboard/BookingsList.tsx" "src/components/features/dashboard/list/useBookingsListState.ts"`
  - `pnpm exec tsc --noEmit --pretty false`

## Artifacts

- Screenshots:
  - `artifacts/ops-dashboard-mobile.png`
  - `artifacts/ops-dashboard-tablet.png`
  - `artifacts/ops-dashboard-desktop.png`
- Lighthouse:
  - `artifacts/report.json`
  - `artifacts/report.html`
- Trace:
  - `artifacts/ops-dashboard-trace.json`

## Known Issues

- Existing unrelated console warnings remain in the harness environment (`GoTrueClient` duplication and form field metadata warnings).

## Sign-off

- [x] Engineering
- [x] QA
