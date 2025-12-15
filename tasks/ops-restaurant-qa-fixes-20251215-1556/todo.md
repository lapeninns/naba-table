---
task: ops-restaurant-qa-fixes
timestamp_utc: 2025-12-15T15:56:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Offline resilience

- [x] Prevent anchor-based navigation in ops content while offline (toast + preventDefault)
- [x] Block ops bookings pagination while offline (toast + no URL update)
- [x] Block ops customers pagination while offline (toast + no page change)

## Security headers

- [x] Add baseline headers in middleware (CSP minimal, Referrer-Policy, nosniff, XFO, Permissions-Policy)

## Floor plan performance + CLS

- [x] Remove O(n²) timeline lookups (`find` per table) by building a tableId → timeline map
- [x] Pre-parse segment times to avoid repeated `Date` parsing on every render
- [x] Progressive rendering for non-critical visuals (grid texture, merge lines, chair DOM)
- [x] Stabilize loading/no-restaurant layout height to reduce CLS
- [x] Add `id`/`name` + `aria-label` to time slider input

## Customers TTFB

- [x] Remove `/customers` server-side prefetch/hydration; rely on client queries + ops layout auth

## Auth warnings

- [x] Stop using session user objects from `onAuthStateChange` in `hooks/useSupabaseSession.ts`

## Verification

- [x] `pnpm typecheck`
- [x] `pnpm build`
- [ ] Chrome DevTools MCP verification on authenticated ops routes (blocked unless ops credentials/session available)
