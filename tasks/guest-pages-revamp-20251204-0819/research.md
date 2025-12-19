---
task: guest-pages-revamp
timestamp_utc: 2025-12-04T08:19:11Z
owner: github:@agent
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Research: Guest Pages Revamp

## Requirements

### Functional

1. **Guest Dashboard (`/guest/dashboard`)**: Complete visual overhaul with premium aesthetics
2. **Booking List (`/guest/bookings`)**: Modern card-based design with improved UX
3. **Profile Management (`/guest/profile`)**: Refined layout with better visual hierarchy
4. **Booking Detail (`/guest/bookings/[bookingId]`)**: Premium ticket-style view
5. **Thank You Page (`/guest/thank-you`)**: Celebratory, engaging confirmation experience

### Non-functional

- **Performance**: Mobile-first, target FCP ≤ 2.0s, LCP ≤ 2.5s
- **Accessibility**: WCAG compliant, keyboard navigable, proper ARIA
- **Responsiveness**: 375px → 1280px+ breakpoints
- **Design System**: Use existing Shadcn components, extend with premium styling

## Existing Patterns & Reuse

### Current Components Found

1. `GuestDashboardClient.tsx` - 393 lines, functional but needs visual refresh
2. `BookingListClient.tsx` - 330 lines, good structure
3. `ProfileManageForm.tsx` - 672 lines, comprehensive form handling
4. `ReservationDetailClient.tsx` - 715 lines, feature-rich
5. `GuestLayout.tsx` - 40 lines, has feature flag for new UI

### Design Tokens Available

- Existing `globals.css` with comprehensive token system
- Guest theme palette (`.guest-theme`) with blue scale
- DLS tokens from Airbnb-inspired design system
- Animation utilities (fade-in, scale-in, slide-up, etc.)

### Reusable UI Components

- `Card`, `Button`, `Badge` from Shadcn
- `Skeleton` for loading states
- `Dialog`, `Tabs` for interactive elements
- Custom animations defined in globals.css

## External Resources

- [Shadcn UI](https://ui.shadcn.com) - Component library foundation
- Modern booking UX patterns (Airbnb, OpenTable, Resy)

## Constraints & Risks

1. **Data contracts unchanged**: Must preserve all existing API hooks and data flows
2. **Feature flag**: `guestUi` flag controls new vs legacy UI
3. **Route stability**: URLs are likely bookmarked by users (no path changes)
4. **Mobile-first mandate**: Heavy mobile traffic expected
5. **Existing functionality**: All current features must be preserved

## Open Questions (resolved)

- Q: Should we create new components or refactor existing ones?
  A: Refactor existing components in-place to avoid scope creep

## Recommended Direction (with rationale)

**Approach: In-place Progressive Enhancement**

1. **Update GuestLayout first** - Set foundation with enhanced visual treatment
2. **Revamp Dashboard** - Hero section with glassmorphism, animated cards
3. **Enhance Booking List** - Improved card design with micro-interactions
4. **Profile Page** - Cleaner form layout with better visual hierarchy
5. **Thank You Page** - Celebration animation, stronger visual impact
6. **Booking Detail** - Premium ticket-style with QR code integration

**Design Principles:**

- Dark slate primary with blue accents (existing `.guest-theme`)
- Rounded corners (2xl for cards, full for buttons)
- Subtle gradients and shadows for depth
- Smooth transitions and micro-animations
- Clear visual hierarchy with typography scale
