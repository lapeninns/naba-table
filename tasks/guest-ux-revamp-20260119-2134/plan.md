---
task: guest-ux-revamp
timestamp_utc: 2026-01-19T21:34:00Z
owner: github:@amanshresthaa
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Guest Portal UX/UI Polish

## Objective

We will polish the existing guest-facing pages with better animations, improved mobile experience, and performance optimizations while keeping the current blue/slate design direction.

## Success Criteria

- [ ] Consistent animation system across all guest pages
- [ ] Enhanced micro-interactions (hover, focus, active states)
- [ ] Improved skeleton loading states
- [ ] Mobile UX refinements (touch targets, gestures)
- [ ] Performance budgets met (FCP ≤ 2.0s, LCP ≤ 2.5s, CLS ≤ 0.10)
- [ ] Chrome DevTools MCP verification completed

## Architecture & Components

### Page Structure (existing pattern to maintain)

```
src/app/guest/
├── layout.tsx           → GuestLayout wrapper
├── page.tsx             → Re-exports dashboard
├── dashboard/page.tsx   → Uses view-model pattern
├── profile/page.tsx     → Uses view-model pattern
├── bookings/
│   ├── page.tsx         → Bookings list
│   └── [bookingId]/
│       ├── page.tsx     → Booking detail
│       └── receipt/page.tsx → Receipt view
└── thank-you/page.tsx   → Redirect only
```

### Components to Update (Polish Focus)

**Animation Consistency:**

- Standardize entrance animations (fade-in-up with consistent timing)
- Add card hover micro-interactions
- Improve button press feedback
- Consistent stagger timing (80ms increments)

**Mobile UX:**

- Verify all touch targets ≥ 44px
- Add active state feedback for touch
- Improve mobile card layouts
- Enhance mobile navigation feedback

**Performance:**

- Refine skeleton loading patterns
- Add optimistic UI for mutations
- Ensure no CLS from dynamic content

## Data Flow & API Contracts

No API changes required - UI-only revamp using existing:

- `services.auth.requireUser()` for protection
- `services.bookings.list()` for booking data
- `services.profile.ensureForUser()` for profile data

## UI/UX States

Each page must handle:

- **Loading**: Skeleton states with smooth transitions
- **Empty**: Friendly messaging with CTAs
- **Error**: Actionable error messages with retry
- **Success**: Clean data presentation

## Edge Cases

- New user with no bookings
- User with many bookings (pagination)
- Expired/cancelled booking display
- Profile with missing optional fields
- Mobile viewport edge cases

## Testing Strategy

- **Unit**: Component isolation tests
- **Integration**: Page rendering with mock data
- **E2E**: Critical guest journeys via Playwright
- **Accessibility**: Axe-core automated checks + manual keyboard testing

## Rollout

- Feature flag: Not needed (UI-only, same functionality)
- Approach: Page-by-page implementation with verification
- Monitoring: Lighthouse scores tracked

## Implementation Order (Polish Focus)

1. ✅ Audit current state & document gaps
2. Add motion/interaction utility classes to CSS
3. Polish GuestDashboardClient
4. Polish GuestProfileClient
5. Polish BookingListClient
6. Polish Receipt page
7. Chrome DevTools MCP verification
