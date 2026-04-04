---
task: remove-floor-plan
timestamp_utc: 2026-04-03T16:41:00Z
owner: github:@OpenAI
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP on authenticated `http://app.localhost:3000`

### Console & Network

- [x] No console errors
- [x] Redirect target loads correctly
- Navigating to `http://app.localhost:3000/floor-plan` redirected to `http://app.localhost:3000/dashboard`.
- Navigating to `http://app.localhost:3000/seating` also redirected to `http://app.localhost:3000/dashboard`.

### DOM & Accessibility

- [x] Floor plan nav item removed
- [x] `/floor-plan` no longer exposes the removed feature
- Verified the authenticated sidebar now lists `Dashboard`, `Bookings`, and `New Bookings` under Service with no `Floor Plan` item.

### Device Emulation

- [x] Desktop

## Test Outcomes

- [x] Scoped lint
- [x] Typecheck
- `npx eslint src/components/features/ops-shell/navigation.tsx 'src/app/app/(app)/floor-plan/page.tsx' 'src/app/app/(app)/seating/page.tsx' 'src/app/app/(app)/seating/floor-plan/page.tsx'`
- `pnpm typecheck`
- `rg -n "floor-plan|FloorPlanPage|Floor Plan|ops-floor-plan" src tests`

## Artifacts

- No screenshots were required for this removal pass; browser verification was redirect- and nav-focused.

## Known Issues

- None found in the removal scope.

## Sign-off

- [x] Engineering
- [ ] Design/PM
- [ ] QA
