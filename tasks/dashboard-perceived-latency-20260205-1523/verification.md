---
task: dashboard-perceived-latency
timestamp_utc: 2026-02-05T15:23:00Z
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

- [ ] No Console errors (redirected to auth; console issue from signin page)
- [ ] Network requests match expected summary/heatmap calls (blocked by auth)

### DOM & Accessibility

- [x] aria-busy present on loading containers
- [x] role="status" used for inline refresh indicators
- [ ] Reduced motion respected (no large animations) (blocked by auth)

### Performance (smoke)

- [ ] No skeleton flash on fast loads (blocked by auth)
- [ ] Refresh indicators delayed/min-duration (blocked by auth)
- [ ] Booking cards stay in place during seat/finish/no-show (blocked by auth)

### Device Emulation

- [ ] Mobile (≈375px) (blocked by auth)
- [ ] Desktop (≥1280px) (blocked by auth)

## Test Outcomes

- [x] `pnpm typecheck`
- [x] `pnpm build`
  - Re-ran after 200/400ms booking card overlay adjustment

## Artifacts

- Screenshots/recordings: `artifacts/dashboard-auth-redirect.png`, `artifacts/dashboard-auth-redirect-2.png`

## Known Issues

- [ ] Dashboard QA blocked by auth redirect to `/app/auth/signin` (console issue: "Incorrect use of <label for=FORM_ELEMENT>" on signin page).

## Sign-off

- [ ] Engineering
- [ ] QA
