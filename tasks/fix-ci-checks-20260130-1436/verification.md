---
task: fix-ci-checks
timestamp_utc: 2026-01-30T14:36:00Z
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

- [ ] No Console errors
- Notes: `/app/dashboard/print` redirected to `/auth/signin` with error boundary. Console errors include nested `<html>/<body>` warnings during error rendering. Server logged cookie mutation error from `ensureCsrfCookie`.

### DOM & Accessibility

- [x] Error state renders heading, copy, and links.

### Performance (profiled; mobile; 4× CPU; 4G)

- Not captured (blocked by auth error).

### Device Emulation

- Not captured.

## Test Outcomes

- [ ] Happy paths
- [x] Error handling
- [ ] A11y (axe): 0 critical/serious
- Notes: Access to print page requires auth; QA executed on fallback error state.

## CI Outcomes

- Pending: will update after workflow runs.
- Vercel preview build was failing with missing `.next/server/middleware.js.nft.json`; build now uses Webpack.
- Webpack build failed on CSS Modules pure selector in print view; fix applied.

## Artifacts

- Screenshot: `artifacts/print-view-error.png`

## Known Issues

- Print view QA blocked by auth flow error on `/auth/signin` (cookies mutation in server component).
