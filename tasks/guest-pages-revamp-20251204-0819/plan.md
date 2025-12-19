---
task: guest-pages-revamp
timestamp_utc: 2025-12-04T08:19:11Z
owner: github:@agent
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Guest Pages Revamp

## Objective

We will enable guests to have a premium, modern experience across all guest-facing pages so that they feel confident and delighted when managing their reservations.

## Success Criteria

- [ ] All 5 pages have cohesive, premium visual design
- [ ] Mobile-first responsive layouts working at 375px, 768px, 1280px+
- [ ] Performance budgets met (FCP ≤ 2.0s, LCP ≤ 2.5s)
- [ ] Keyboard navigation functional on all interactive elements
- [ ] Existing functionality preserved (no regressions)

## Architecture & Components

### 1. GuestLayout Enhancement

- Add enhanced gradient backdrop
- Improve header/footer integration
- Enable smooth transitions

### 2. Guest Dashboard (`GuestDashboardClient.tsx`)

- **Hero Section**: Personalized greeting with time-based message
- **Featured Booking**: Premium ticket-style card with QR code
- **Quick Actions**: Icon grid with hover animations
- **Upcoming Bookings**: Streamlined list view
- **Favorites**: Visual cards for repeat visits

### 3. Booking List (`BookingListClient.tsx`)

- **Header**: Bold typography with action button
- **Tabs**: Clean underline-style tab switcher
- **Cards**: Enhanced with date box, hover effects
- **Empty States**: Engaging illustrations and CTAs

### 4. Profile Management

- **Avatar Section**: Large avatar with quick actions
- **Form Fields**: Icon-prefixed inputs
- **Action Bar**: Sticky save/discard with status

### 5. Thank You Page

- **Celebration**: Animated success icon
- **Confirmation**: Clear messaging
- **Actions**: Prominent CTAs to view booking

### 6. Booking Detail

- **Header**: Status badge, reference number
- **Info Cards**: Date/Time/Guests in card grid
- **Guest Details**: Icon-prefixed list
- **Actions Sidebar**: Sticky manage panel

## UI/UX States

- **Loading**: Skeleton loaders matching content layout
- **Empty**: Illustrated empty states with CTAs
- **Error**: Clear error messaging with retry
- **Success**: Confirmation feedback

## Testing Strategy

- Manual testing at 375px, 768px, 1280px viewports
- Keyboard navigation testing
- Screen reader testing with axe-core
- Visual regression spot-check

## Rollout

- No feature flag changes required (uses existing guestUi flag)
- Deploy as single atomic change
