---
task: floor-plan-readonly-redesign
timestamp_utc: 2026-04-03T14:24:12Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Verification Surface

- Primary route visited: `http://app.localhost:3000/floor-plan`
- Fallback harness used for interaction proof: `http://localhost:3000/dev/ops-floor-plan`
- Rationale: the authenticated route remained on `Loading floor plan…` / `Fetching table layout.` despite all expected ops data requests returning `200`.

### Console & Network

- [x] No blocking console errors surfaced on either route during verification.
- [x] Canonical route `/floor-plan` loads and requests the expected ops endpoints.
- [x] Authenticated route blocker captured with screenshot and network evidence:
- `artifacts/floor-plan-auth-loading.png`
- `/api/ops/restaurants/:id/hours` `200`
- `/api/ops/restaurants/:id/service-periods` `200`
- `/api/ops/restaurants/:id` `200`
- `/api/ops/zones` `200`
- `/api/ops/tables?includeSummary=0` `200`
- `/api/ops/tables/timeline?...&includeSummary=0` `200`

### DOM & Accessibility

- [x] Read-only shell verified on the harness. No booking creation, assignment, or booking-navigation controls remain in the header or details surfaces.
- [x] Legend and visible-summary counts verified. Desktop harness showed `65 visible tables` at `19:30` with `25 available`, `40 reserved`, `0 seated`, `0 loading`, `0 out of service`.
- [x] Desktop details panel verified. Selecting `Table 51` shows passive facts only (`Capacity`, `Zone`, `Seating`, `Timing`) with no CTA buttons.
- [x] Mobile details sheet verified. Selecting `Table 51` opens a `Table details` dialog with the same passive content and closes correctly.
- [x] Search-hide reset verified. Filtering to `zzzz` produces `No tables match "zzzz".`, drops visible count to `0`, and clears the previous selection back to the idle details copy.
- [x] Keyboard pan/zoom/reset verified on the harness. Transform changed from `translate(0px, 0px) scale(0.75)` to `translate(20px, 0px) scale(0.75)` after `ArrowRight`, to `translate(20px, 0px) scale(0.85)` after `+`, then back to `translate(0px, 0px) scale(0.75)` after `Home`.
- [x] Time scrubber controls verified. Stepping backward changed the displayed time from `19:30` to `19:15` and updated visible occupancy counts accordingly.
- [x] Lighthouse snapshot (desktop harness) improved to Accessibility `96`, Best Practices `100`, SEO `100`.

### Device Emulation

- [x] Desktop (`1440x1100`)
- [x] Mobile (`390x844`)

## Test Outcomes

- [x] Focused floor-plan Vitest suite
- Command: `npx vitest run tests/ops/useFloorPlanTables.test.tsx tests/components/floor-plan --passWithNoTests --maxWorkers=9`
- Result: `5` files passed, `14` tests passed
- [x] `pnpm typecheck`
- Command: `pnpm typecheck`
- Result: pass
- [x] Scoped ESLint checks
- Command: `npx eslint "src/components/features/seating/**/*.{ts,tsx}" "src/app/app/(app)/floor-plan/page.tsx" "src/app/app/(app)/seating/page.tsx" "src/app/app/(app)/seating/floor-plan/page.tsx" "src/app/(public)/dev/ops-floor-plan/**/*.{ts,tsx}" "tests/ops/useFloorPlanTables.test.tsx" "tests/components/floor-plan/**/*.{ts,tsx}"`
- Result: pass

## Artifacts

- Screenshots:
- `artifacts/floor-plan-auth-loading.png`
- `artifacts/floor-plan-harness-desktop.png`
- `artifacts/floor-plan-harness-mobile.png`
- `artifacts/floor-plan-harness-mobile-sheet.png`
- Lighthouse:
- `artifacts/report.json`
- `artifacts/report.html`

## Known Issues

- [x] Pre-existing unrelated Vitest baseline failures in email/auth suites are out of scope for this mission and documented in mission AGENTS/handoff metadata.
- [x] Authenticated `/floor-plan` remains blocked on the existing loading shell in local dev even when the required ops requests complete successfully. The route-level blocker prevented full canonical-route interaction proof in this session.
- [x] Lighthouse still reports one remaining accessibility issue on the harness: `target-size` for several tightly packed table buttons in the dense map cluster. This appears tied to existing floor-map geometry rather than the read-only redesign itself.

## Sign-off

- [x] Engineering
