---
task: app-dashboard-first-load-issue
timestamp_utc: 2025-12-27T18:42:31Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Console & Network

- [x] Console errors captured (none relevant)
- [x] Network failures captured (initial request redirected to /auth/signin)

### DOM & Accessibility

- [ ] N/A

### Performance (profiled; mobile; 4× CPU; 4G)

- N/A

### Device Emulation

- [ ] Desktop (≥1280px)

## Test Outcomes

- [x] Root cause reproduced
- [x] Fix verified (manual: root /auth/signin with ops target redirects to app host)
- [ ] Evidence captured in artifacts

## Artifacts

- Screenshots/logs: `artifacts/`

## Known Issues

- [ ] app.localhost first hit to /dashboard redirects to /auth/signin when no app subdomain session cookie is present; subsequent app-route visit establishes session cookie. (owner: github:@amankumarshrestha, priority: medium)

## Notes

- DevTools MCP: navigating to `http://app.localhost:3000/dashboard` redirected to `/auth/signin?redirectedFrom=%2Fdashboard`. Network shows `/api/auth/signin` followed by `/api/dashboard/summary` after session established.
- DevTools MCP: navigating to `http://localhost:3000/auth/signin?redirectedFrom=/dashboard` now redirects to `http://app.localhost:3000/dashboard` (ops-host enforced).

## Sign-off

- [ ] Engineering
- [ ] QA
