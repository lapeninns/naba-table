---
task: restaurant-onboarding-fix
timestamp_utc: 2025-12-02T12:31:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Console & Network

- [x] No console errors while running signup → profile → hours → services → tables (watched via DevTools overlay).
- [x] Network requests match contract after fixes: `/api/ops/restaurants/:id/hours` GET/PUT 200, `/api/ops/occasions` 200, `/api/onboarding/restaurant/:id/tables` 200.

### DOM & Accessibility

- [x] Semantic structure intact across onboarding steps.
- [x] Focus/keyboard works for form inputs and table fields (tab/shift+tab).
- [x] Visible focus rings on interactive elements.

### Performance (spot check; desktop Chrome devtools)

- Turbopack dev build; no noticeable layout shifts. Formal perf budget not profiled (dev mode).

### Device Emulation

- [x] Desktop (full width) — validated.

## Test Outcomes

- [x] Happy paths
- [ ] Error handling
- [ ] A11y (axe): 0 critical/serious
- Notes:
  - `pnpm test --filter "ops/restaurants"` failed because Vitest CLI does not support `--filter` (Unknown option error).
  - `pnpm test -- --help` triggered existing failing test in `src/app/api/ops/occasions/route.test.ts` (missing mock for `getServiceSupabaseClient`), unrelated to this change.

## Artifacts

- Hours step screenshot: `tasks/restaurant-onboarding-fix-20251202-1231/artifacts/onboarding-hours.png`
- Services step screenshot: `tasks/restaurant-onboarding-fix-20251202-1231/artifacts/onboarding-services.png`

## Known Issues

- [ ] Direct navigation to `/onboarding/review?rid=…` sometimes redirects back to profile; after table save router push returned 200 for review. Worth re-checking in another session. (owner: us, priority: medium)

## Sign-off

- [ ] Engineering
- [ ] Design/PM
- [ ] QA
