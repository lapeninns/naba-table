---
task: hide-three-horseshoes
timestamp_utc: 2026-04-07T10:28:00Z
owner: github:@OpenAI
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Console & Network

- [x] No console warnings/errors on the verified local route
- [x] Local network request to `/restaurants/three-horseshoes` returned 404 with patched code

### DOM & Accessibility

- [x] Verified the not-found page renders a single H1 (`Page not found`)
- [x] Verified the route exposes a recoverable link (`Go to Dashboard`)

### Performance (profiled; mobile; 4× CPU; 4G)

- Not profiled. This task changes server-side visibility logic rather than performance-sensitive UI rendering.
- Budgets met: [ ] Yes [x] No (notes)

### Device Emulation

- [ ] Not run

### Verification Surface

- Local proof route: `http://localhost:3001/restaurants/three-horseshoes`
- Result: browser snapshot showed `Restaurant Not Found · Nab a Table` and a `Page not found` heading.
- Fallback note: local dev required temporary placeholder env values for unrelated required secrets before the route could render.

## Test Outcomes

- [x] `pnpm vitest run tests/server/restaurant-visibility.test.ts tests/hooks/useUpdateRestaurant.test.tsx tests/guest/public-restaurants-pages.test.tsx`
- [x] `pnpm typecheck`

## Artifacts

- Production row update: `artifacts/production-restaurant-row.json`
- Local browser proof: `artifacts/local-browser-proof.txt`
- Live URL check: `artifacts/live-url-check.txt`

## Known Issues

- [x] Production row update has been applied and `restaurants.is_active` is now `false` for Three Horseshoes.
- [x] The live production URL still returns HTTP 200 because the current deployed build does not yet enforce `is_active` on public slug lookups.
- [ ] Deploy the code changes from this task so the live route begins returning not found.

## Sign-off

- [x] Engineering
- [ ] Design/PM
- [ ] QA
