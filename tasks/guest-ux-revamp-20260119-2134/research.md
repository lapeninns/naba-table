---
task: guest-ux-revamp
timestamp_utc: 2026-01-19T21:34:00Z
owner: github:@amanshresthaa
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Research: Guest Portal UX/UI Revamp

## Requirements

### Functional

- Revamp all guest-facing protected pages for modern, polished UX
- Pages in scope:
  - `/guest` (index → dashboard)
  - `/guest/dashboard` - Main landing page
  - `/guest/profile` - Personal details & settings
  - `/guest/bookings` - Booking list with tabs (upcoming/past)
  - `/guest/bookings/[bookingId]` - Booking detail
  - `/guest/bookings/[bookingId]/receipt` - Receipt view

### Non-functional

- **A11y**: WCAG compliant, keyboard navigation, screen reader support
- **Performance**: FCP ≤ 2.0s, LCP ≤ 2.5s, CLS ≤ 0.10, TBT ≤ 200ms
- **Mobile-first**: Responsive from 375px to ultra-wide
- **Design**: Avoid "AI slop" - distinctive, intentional design choices

## Existing Patterns & Reuse

### Current Component Inventory (COMPLETED)

**Layout Components:**

- `GuestLayout` - Main wrapper with ThemeProvider, GuestNavbar, Footer
- `GuestBackground` - Subtle grid pattern overlay
- `GuestNavbar` - Responsive nav with mobile Sheet, avatar dropdown

**Page Client Components:**

- `GuestDashboardClient` - Hero + next booking + upcoming list + sidebar stats
- `GuestProfileClient` - Hero + form with name/phone fields
- `BookingListClient` - Hero + tabs (upcoming/past) + booking cards

**Shared UI:**

- Badge variants: status-confirmed, status-pending, status-cancelled, status-completed
- Card variants: featured, interactive
- Custom components: FeaturedBooking, UpcomingBookingCard, StatPill, StatusBadge

**Animation System (existing):**

- Keyframes: fade-in, fade-up, slide-up, scale-in, shimmer
- Transition tokens: --guest-transition-fast (150ms), base (200ms), slow (300ms)
- Stagger utilities: .stagger-container, .guest-stagger
- Reduced motion: proper @media (prefers-reduced-motion) support

### Layout System

- `GuestLayout` - Main wrapper at `src/components/layouts/GuestLayout.tsx`
- Uses `guest-theme` CSS class for styling

### Page Architecture

- Pages use View Model pattern:
  - `page.tsx` → thin wrapper
  - `view-model.ts` → data fetching + auth
  - `page-view.tsx` → composition
  - `*Client.tsx` → interactive UI

### Services

- Auth: `src/guest/services/adapters/auth.server.ts`
- Bookings: `src/guest/services/bookings-params.ts`
- Profile: via services object

## External Resources

- AGENTS.md root policy
- `skills/frontend-aesthetics.md` - Design principles
- `skills/style-principles.md` - DRY/KISS/YAGNI
- Shadcn UI component library

## Constraints & Risks

- **Must use Shadcn primitives** - No custom base components
- **Remote Supabase only** - No local DB changes
- **Protected routes** - Must maintain auth guards
- **Mobile-first** - Build for small screens first

## Open Questions (owner, due)

- Q: What is the current visual state of each page?
  A: COMPLETED - Comprehensive inventory above shows polished foundation

- Q: Which Shadcn components are available in project?
  A: COMPLETED - @shadcn registry with 438+ items (accordion, badge, button, card, tabs, skeleton, avatar, dropdown-menu, sheet, etc.)

- Q: What is the guest theme color palette?
  A: COMPLETED - Blue primary scale (50-900), coral accent, slate neutrals, HSL-based

## Gaps Identified for Polish

### 1. Animation Polish

- Stagger animations exist but need consistent application
- Some components lack entrance animations
- Need micro-interaction feedback on button/card hovers

### 2. Mobile Experience

- Touch targets adequate (min-h-[44px]/[48px] in place)
- Could improve: swipe gestures for booking cards, pull-to-refresh UX
- Mobile nav already uses Sheet - good

### 3. Performance

- Skeleton loading states exist but could be more refined
- Need to verify CLS prevention on image loads
- Could add optimistic UI for profile updates

### 4. Consistency Issues

- Some hardcoded colors vs CSS variables
- Animation delay syntax varies (80ms vs 50ms increments)
- Some components use animate-fade-in-up, others use custom classes

## Recommended Direction

1. Audit current guest UI components and identify gaps
2. Define cohesive design direction using Frontend Aesthetics skill
3. Implement page-by-page using Shadcn components
4. Verify each page via Chrome DevTools MCP
