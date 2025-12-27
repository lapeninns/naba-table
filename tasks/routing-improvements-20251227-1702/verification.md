---
task: routing-improvements
timestamp_utc: 2025-12-27T17:02:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

- Not required (no UI change).

## Test Outcomes

- [x] Proxy tests: `pnpm vitest run src/proxy.test.ts`
- [x] Routing smoke script: `node scripts/route-smoke.cjs`

## Artifacts

- N/A

## Smoke Output

```
localhost:3000/
  200
localhost:3000/restaurants
  200
localhost:3000/guest
  200
localhost:3000/guest/dashboard
  200
localhost:3000/auth/signin
  200
localhost:3000/dashboard
  404
localhost:3000/app/dashboard
  308 http://app.localhost:3000/dashboard

app.localhost:3000/
  308 /dashboard
app.localhost:3000/restaurants
  307 /auth/signin?redirectedFrom=%2Frestaurants
app.localhost:3000/guest
  308 /guest
app.localhost:3000/guest/dashboard
  308 /guest/dashboard
app.localhost:3000/auth/signin
  200
app.localhost:3000/dashboard
  307 /auth/signin?redirectedFrom=%2Fdashboard
app.localhost:3000/app/dashboard
  308 http://app.localhost:3000/dashboard
```

## Known Issues

- [ ] None

## Sign-off

- [ ] Engineering
- [ ] QA
