---
task: floor-plan-occupancy-board-redesign
timestamp_utc: 2026-04-03T16:07:37Z
owner: github:@OpenAI
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP on authenticated `http://app.localhost:3000/floor-plan`

### Console & Network

- [x] No console errors
- [x] Network requests match contract
- Observed clean `200` responses for the authenticated floor-plan boot path, including restaurant, zones, tables, timeline, and Supabase session requests.

### DOM & Accessibility

- [x] Semantic HTML verified
- [x] ARIA attributes correct
- [x] Focus order logical and visible
- [x] Keyboard-only flows succeed
- Verified the board renders a titled occupancy stage, preserves the `Floor plan canvas` region help text, keeps the timeline slider labeled, and preserves the passive table-details inspector behavior after selection.

### Performance (profiled; mobile; 4× CPU; 4G)

- Snapshot Lighthouse on mobile:
- Accessibility: 100
- Best Practices: 100
- SEO: 100
- Performance metrics: not captured in this pass because the DevTools snapshot audit excludes performance timing.
- Budgets met: [x] Yes [ ] No
- Note: accessibility, best-practices, and SEO all passed with zero failed audits in the mobile snapshot run.

### Device Emulation

- [x] Mobile
- [ ] Tablet
- [x] Desktop
- Desktop: authenticated route reloaded cleanly at `1440x1100`, showing the redesigned dark board with the new service-read masthead, control rail, and docked timeline.
- Mobile: authenticated route stacked correctly at `390x844`, keeping the board, control rail, and timeline readable in a single-column flow.

## Test Outcomes

- [x] Focused floor-plan tests
- [x] ESLint
- [x] Typecheck
- `npx vitest run tests/ops/useFloorPlanTables.test.tsx tests/components/floor-plan --passWithNoTests --maxWorkers=9`
- `npx eslint "src/components/features/seating/**/*.{ts,tsx}" "src/app/app/(app)/floor-plan/page.tsx" "src/app/app/(app)/seating/page.tsx" "src/app/app/(app)/seating/floor-plan/page.tsx" "src/app/(public)/dev/ops-floor-plan/**/*.{ts,tsx}" "src/app/providers.tsx" "tests/ops/useFloorPlanTables.test.tsx" "tests/components/floor-plan/**/*.{ts,tsx}"`
- `pnpm typecheck`

## Artifacts

- Desktop screenshot: `artifacts/floor-plan-desktop-clean.png`
- Mobile screenshot: `artifacts/floor-plan-mobile.png`
- Lighthouse reports: `artifacts/report.json`, `artifacts/report.html`
- Additional desktop interaction screenshot: `artifacts/floor-plan-desktop.png`

## Known Issues

- No new board-specific issues found in this pass.
- Shared shell-level concerns outside the board remain out of scope unless separately requested.

## Sign-off

- [x] Engineering
- [ ] Design/PM
- [ ] QA
