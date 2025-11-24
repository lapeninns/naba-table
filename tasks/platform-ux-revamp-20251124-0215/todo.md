---
task: platform-ux-revamp
timestamp_utc: 2025-11-24T02:31:00Z
owner: github:@amanshresthaa
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# TODO: Platform UX/UI Revamp

## Phase 1: Foundation & Landing ✅ COMPLETE

### Shared Components

- [x] Create PageHero component
- [x] Create FeatureCard component
- [x] Create PageSection component

### Landing Page (/)

- [x] Build hero section with gradient
- [x] Add "How It Works" (3 steps)
- [x] Add Features section
- [x] Add CTA section
- [x] Add footer
- [x] Mobile-first responsive design
- [x] Staggered animations

### Sign-In Page (/auth/signin)

- [x] Create SignInForm component
- [x] Enhance page layout (card design)
- [x] Add loading states
- [x] Add error handling
- [x] Improve visual hierarchy
- [x] Add "Back to home" link

## Phase 2: Guest Experience 🚧 IN PROGRESS

### Guest Dashboard (/guest/dashboard)

- [ ] Review current implementation
- [ ] Create welcome section with user name
- [ ] Add upcoming bookings preview (next 3)
- [ ] Add quick action cards
- [ ] Create empty state for new users
- [ ] Add stats/summary cards
- [ ] Improve mobile layout
- [ ] Add animations

### Guest Bookings List (/guest/bookings)

- [x] Review current implementation
- [x] Create tabs: Upcoming / Past
- [x] Design BookingCard component
- [x] Add status indicators
- [x] Create empty state
- [x] Add quick actions (view booking)
- [x] Improve mobile card layout
- [x] Add loading states
- [x] Add icons (CalendarClock, MapPin, Users)

### Guest Booking Detail (/guest/bookings/[bookingId])

- [ ] Review current implementation
- [ ] Enhance detail card layout
- [ ] Add icons to details
- [ ] Improve status badge
- [ ] Add action buttons (cancel, modify)
- [ ] Add map/directions section (future)
- [ ] Improve mobile layout

## Phase 3: Profile & Confirmations

### Guest Profile (/guest/profile)

- [ ] Review current implementation
- [ ] Create profile form sections
- [ ] Add preferences section
- [ ] Add notification settings
- [ ] Add security section
- [ ] Improve layout and spacing

### Thank You Pages

- [ ] Polish /thank-you (generic)
- [ ] Polish /restaurants/[slug]/book/thank-you
- [ ] Polish /bookings/[bookingId]/thank-you
- [ ] Add better animations
- [ ] Consistent card styling

## Phase 4: Polish & Testing

### Testing

- [ ] Cross-browser testing (Chrome, Safari, Firefox)
- [ ] Mobile device testing (real devices)
- [ ] Accessibility audit (axe DevTools)
- [ ] Performance audit (Lighthouse)
- [ ] Dark mode verification
- [ ] Keyboard navigation testing

### Documentation

- [ ] Update README with screenshots
- [ ] Document component usage
- [ ] Create style guide
- [ ] Add deployment notes

## Notes

### Phase 1 Routing Issue

- Landing page at `/` redirects to `/guest` (likely middleware)
- Sign-in form created but may need server restart to reflect
- All components created successfully
- Design system consistent with wizard improvements

### Design Consistency

- Using same color palette as wizard
- Same icon sizes (h-4 w-4, h-5 w-5)
- Same spacing scale (gap-3, gap-4, gap-6)
- Same typography scale
- Touch targets ≥44px
