---
task: devtools-restaurant-qa
timestamp_utc: 2025-12-15T11:56:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# QA Checklist (DevTools): Restaurant-Facing Routes

## Setup

- [ ] Start dev server (`pnpm dev`)
- [ ] Verify app host works: `http://app.localhost:3000/auth/signin`
- [ ] Authenticate as restaurant staff (needed for protected routes)

## Routes (Smoke)

- [ ] `/` redirects to `/dashboard`
- [ ] `/dashboard`
- [ ] `/bookings`
- [ ] `/customers`
- [ ] `/seating` redirects to `/seating/floor-plan`
- [ ] `/seating/floor-plan`
- [ ] `/seating/capacity`
- [ ] `/management` redirects to `/management/team`
- [ ] `/management/team`
- [ ] `/settings` redirects to `/settings/restaurant/profile`
- [ ] `/settings/restaurant`
- [ ] `/settings/restaurant/profile`
- [ ] `/settings/restaurant/operating-hours`
- [ ] `/settings/restaurant/service-periods`
- [ ] `/settings/restaurant/occasions`
- [ ] `/settings/restaurant/team`
- [ ] `/settings/tables`
- [ ] `/new-bookings` (if present/linked)

## Performance

- [ ] Cold-load Performance trace for `/dashboard`
- [ ] Warm navigation trace between `/dashboard` → `/bookings` → `/settings/restaurant/profile`
- [ ] Record long tasks + main-thread bottlenecks
- [ ] Capture CWV proxies (LCP/CLS) from trace
- [ ] Memory: heap snapshot before/after navigation loop; confirm no unbounded growth

## Network & API

- [ ] Validate status codes & payloads for key ops APIs (`/api/ops/*` rewrites)
- [ ] Throttling: Fast 3G; verify UI fallback and timeouts
- [ ] Offline: verify errors surfaced and no infinite spinners
- [ ] Cache headers for static assets

## Security & Console

- [ ] Console: no uncaught errors; log noisy warnings
- [ ] Mixed content & CORS/CSP: no violations
- [ ] Response headers: verify baseline security headers present

## Responsive & Device

- [ ] Mobile (≈375px)
- [ ] Tablet (≈768px)
- [ ] Desktop (≥1280px)
- [ ] Touch targets and scrolling behavior

## Accessibility

- [ ] Keyboard-only navigation works; focus visible and logical
- [ ] Forms have labels; errors announced appropriately
- [ ] Lighthouse a11y report captured (or document why unavailable)

## Storage / PWA

- [ ] Cookies: session + CSRF cookie present and scoped correctly
- [ ] Local/session storage usage verified; no sensitive data stored unnecessarily
- [ ] Service worker / Cache Storage behavior verified
