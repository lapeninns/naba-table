---
task: guest-ui-revamp
timestamp_utc: 2026-01-05T09:15:00Z
owner: github:@ai-agent
status: in_progress
---

# Implementation Checklist

## Setup & Dependencies

- [x] Install missing Shadcn components via MCP
  - [x] Tabs component (already installed)
  - [x] Avatar component (already installed)
  - [x] Separator component (already installed)
  - [x] Toast component + Toaster provider (already installed)
- [x] Create enhanced design tokens file (`styles/themes/guest-enhanced.css`)
- [x] Import enhanced tokens in globals.css

## Design Tokens & Foundation

- [x] Create `styles/themes/guest-enhanced.css` with:
  - [x] Warm neutral colors (--color-surface-warm, --color-surface-elevated, --color-surface-muted)
  - [x] Enhanced blue scale hover states
  - [x] Layered shadow system (--shadow-card, --shadow-card-hover, --shadow-featured)
  - [x] Motion variables (--duration-fast, --duration-normal, --ease-out)
  - [x] Background gradients (.bg-gradient-hero, .bg-gradient-warm)
  - [x] Typography enhancements (.heading-hero, .heading-section, .text-body-warm)
  - [x] Animation utilities (.animate-fade-in-up, .stagger-container)
  - [x] Print styles for receipts
- [x] Verify design tokens work in dev environment (build passes)

## Component Enhancements

### Card Variants

- [x] Extend Shadcn Card component with new variants:
  - [x] `variant="featured"` - Large hero card style
  - [x] `variant="interactive"` - Hover lift effect
  - [x] `variant="compact"` - List item style
- [x] Test card variants render correctly (build passes)

### Badge Variants

- [x] Extend Shadcn Badge component with status variants:
  - [x] `variant="status-confirmed"` - Green
  - [x] `variant="status-pending"` - Amber
  - [x] `variant="status-completed"` - Slate
  - [x] `variant="status-cancelled"` - Red
  - [x] `variant="metric"` - Stat pills
- [x] Test badge variants render correctly (build passes)

## Page Implementation (Priority Order)

### 1. Dashboard (`/guest/dashboard`) - HIGHEST PRIORITY

#### Hero Section

- [x] Read `src/components/features/guest/dashboard/GuestDashboardClient.tsx`
- [x] Replace `bg-gradient-to-r from-blue-50 to-white` with `.bg-gradient-hero`
- [x] Update padding (py-10 → py-16, added px-6)
- [x] Apply `.heading-hero` typography to greeting
- [x] Apply `.text-body-warm` to description
- [x] Add `animate-fade-in-up` animation
- [x] Increase button min-height to 48px (accessibility)
- [x] Update root container background to `bg-surface-warm`

#### Featured Booking Card

- [x] Update featured booking to use Card `variant="featured"`
- [x] Add hover lift effect via `.card-interactive` class
- [x] Use Badge `variant="status-confirmed"` for "Happening today"
- [x] Loading state uses Card variant="featured"
- [x] Empty state kept as-is (intentional dark background design)

#### Upcoming Bookings List

- [x] Update cards to use Card `variant="interactive"`
- [x] Add stagger-container to grid for animations
- [x] Use Badge `variant="metric"` for count display
- [x] Empty state updated to use Card with bg-surface-elevated
- [x] Increase CTA button min-height to 44px

#### Sidebar

- [x] Update stats card to use Card component
- [x] Update favorites card to use Card component
- [x] Update profile card to use Card component with bg-slate-50
- [x] All cards now use consistent shadow-card system
- [x] Touch targets already ≥44px (buttons use full width)
- [x] Note: Avatar component not added (using icon instead - simpler, matches design)

#### Dashboard Testing

- [ ] Run Lighthouse audit (mobile, 4× CPU, 4G)
- [ ] Save Lighthouse JSON to `artifacts/dashboard-lighthouse.json`
- [ ] Test keyboard-only navigation
- [ ] Run Axe DevTools (verify 0 critical/serious issues)
- [ ] Capture screenshots (mobile/tablet/desktop) in `artifacts/dashboard-*.png`

### 2. Bookings List (`/guest/bookings`) - COMPLETE ✅

#### Hero Section

- [x] Read `src/components/features/booking/list/BookingListClient.tsx`
- [x] Replace `<GuestSection>` with custom hero section using `.bg-gradient-hero`
- [x] Apply `.heading-hero` to page title "Your Trips"
- [x] Apply `.text-body-warm` to description
- [x] Add `animate-fade-in-up` animation to hero content
- [x] Increase "New Booking" button min-height to 48px
- [x] Update root container to `bg-surface-warm`

#### Tabs & Navigation

- [x] Update TabsList styling (border-b, transparent bg, rounded-none)
- [x] Update TabsTrigger with border-b-2 for active state
- [x] Use Badge `variant="metric"` for upcoming count (blue pill)
- [x] Keep secondary badge for past count (subtle gray)
- [x] Tabs already connected to URL state (existing implementation)
- [x] Min-height 44px for touch targets

#### Empty States

- [x] Upcoming empty: Card with bg-surface-elevated, Calendar icon, centered text
- [x] Past empty: Card with bg-surface-elevated, Calendar icon, centered text
- [x] Both CTAs use rounded-full buttons with min-h-[44px]

#### Booking Cards

- [x] Update BookingCard to use Card `variant="interactive"`
- [x] Add opacity transition for past bookings (opacity-75 hover:opacity-100)
- [x] Apply stagger animations (`stagger-container`, 80ms delay)
- [x] Footer link replaced GuestCard footer prop (cleaner integration)

#### Status Badges

- [x] Update StatusBadge to use new Badge variants
- [x] `status-confirmed` for confirmed/checked_in
- [x] `status-pending` for pending/pending_allocation
- [x] `status-completed` for completed/past
- [x] `status-cancelled` for cancelled/no_show
- [x] Fallback to secondary variant with custom styles

#### Loading & Error States

- [x] Update loading skeleton to use bg-surface-warm
- [x] Update error state background to bg-surface-warm
- [x] Hero skeleton with warm gradient background

#### Build Verification

- [x] TypeScript build passes (0 errors)
- [x] All imports correct (Card, Badge variants)
- [x] Fixed duplicate code sections (removed orphaned JSX)

#### Testing (Pending)

- [ ] Run Lighthouse audit → `artifacts/bookings-lighthouse.json`
- [ ] Test tab keyboard navigation (arrow keys)
- [ ] Test responsive layout (375px → 1920px)
- [ ] Capture screenshots → `artifacts/bookings-*.png`

### 3. Profile (`/guest/profile`) - COMPLETE ✅

#### Hero Section

- [x] Read `src/components/features/guest/profile/GuestProfileClient.tsx`
- [x] Replace header with custom hero section using `.bg-gradient-hero`
- [x] Apply `.heading-hero` to page title "Your Profile"
- [x] Apply `.text-body-warm` to description
- [x] Add `animate-fade-in-up` animation to hero content
- [x] Update root container to `bg-surface-warm`
- [x] Add "Settings" eyebrow label with uppercase tracking

#### Stats Overview

- [x] Keep existing MetricTile components (Account Status, Email Verified)
- [x] Update container to use `stagger-container` for animations
- [x] Stats already use appropriate styling

#### Form Section

- [x] Replace `<GuestSection>` with Card component
- [x] Card uses `p-6 sm:p-8 bg-surface-elevated`
- [x] Add section header with `.heading-section` typography
- [x] Add Separator between stats and form sections
- [x] Update all Input fields:
  - [x] Increased height to h-12 (≥16px font for mobile)
  - [x] Added `type` attributes (text, email, tel)
  - [x] Added `autoComplete` attributes (name, email, tel)
  - [x] Added `text-base` class for 16px font
- [x] Update Save button:
  - [x] Use `bg-primary` instead of hardcoded slate-900
  - [x] Increased min-height to 48px (primary CTA)
  - [x] Keep rounded-full and icon

#### Toast Notifications

- [x] Import `useToast` hook from `@/hooks/use-toast`
- [x] Add success toast on profile update
- [x] Add error toast (destructive variant) on update failure
- [x] Toaster already present in global layout

#### Build Verification

- [x] TypeScript build passes (0 errors)
- [x] All imports correct (Card, Separator, useToast)
- [x] Removed old GuestSection, HeadingXL, TextBody imports

#### Testing (Pending)

- [ ] Test form validation (empty name, invalid phone)
- [ ] Test Toast notifications (success/error)
- [ ] Test keyboard navigation (Tab through fields, Enter submits)
- [ ] Run Lighthouse audit → `artifacts/profile-lighthouse.json`
- [ ] Test responsive layout (375px → 1920px)
- [ ] Capture screenshots → `artifacts/profile-*.png`

### 4. Individual Booking Detail (`/guest/bookings/[id]`) - COMPLETE ✅

#### BookingComponents.tsx Updates

- [x] Read `src/components/features/booking/ui/BookingComponents.tsx`
- [x] Update `BookingDetailShell`: bg-surface-warm, min-h-screen, px-6
- [x] Update `BookingSummaryCard`:
  - [x] Use Card `variant="featured"`
  - [x] Use `bg-surface-elevated`
  - [x] Apply `.heading-hero` and `.text-heading` to title
  - [x] Apply `.text-subtle` to description
  - [x] Back button min-h/min-w-[44px] for accessibility
  - [x] Add `animate-fade-in-up` animation
- [x] Update `DetailStatCard`:
  - [x] Use Card `variant="interactive"`
  - [x] Icon background changed to blue-50/blue-600
  - [x] Labels use `.text-subtle`
- [x] Update `PrimaryButtonLink`: bg-primary hover:bg-primary/90, min-h-[48px]
- [x] Update `SecondaryButton`: Add min-h-[44px]
- [x] Update `GhostButton`: Add min-h-[44px]

#### ReservationDetailClient.tsx Updates

- [x] Read `src/components/features/booking/detail/ReservationDetailClient.tsx`
- [x] Import Card component from `@/components/ui/card`
- [x] Update loading skeleton: Add bg-surface-warm, px-6
- [x] Update error state: Add bg-surface-warm
- [x] Update action buttons:
  - [x] "Modify Details" button: bg-primary hover:bg-primary/90, min-h-[48px]
  - [x] "Cancel Booking" button: min-h-[44px]
- [x] Update history card: Use Card component with bg-surface-elevated

#### Build Verification

- [x] TypeScript build passes (0 errors)
- [x] All imports correct (Card component added)
- [x] All button touch targets meet accessibility requirements

#### Testing (Pending)

- [ ] Test all booking statuses (confirmed, pending, cancelled, completed)
- [ ] Test action buttons (Modify, Cancel, Book Again)
- [ ] Test Share and Download PDF functionality
- [ ] Run Lighthouse audit → `artifacts/booking-detail-lighthouse.json`
- [ ] Test responsive layout (375px → 1920px)
- [ ] Capture screenshots → `artifacts/booking-detail-*.png`

### 5. Receipt (`/guest/bookings/[id]/receipt`)

- [ ] Read `src/app/guest/bookings/[bookingId]/receipt/ReceiptClient.tsx`
- [ ] Add print-friendly styles (`@media print`)
- [ ] Clean, structured layout for printability
- [ ] Ensure QR code renders correctly
- [ ] Test print preview
- [ ] Capture screenshot → `artifacts/receipt.png`

### 6. Thank You Page (`/guest/thank-you`)

- [ ] Read `src/app/guest/thank-you/page.tsx`
- [ ] Create celebratory design (success green accent)
- [ ] Add clear next steps
- [ ] Add link back to dashboard
- [ ] Test responsive layout
- [ ] Capture screenshot → `artifacts/thank-you.png`

## Layout & Background Updates

- [ ] Read `src/components/layouts/GuestLayout.tsx`
- [ ] Update GuestBackground component with warm gradient
- [ ] Apply background texture class
- [ ] Verify layout doesn't break existing pages
- [ ] Test safe-area-inset support (mobile notches)

## Animation Implementation

- [ ] Create utility hook or component for `prefers-reduced-motion` detection
- [ ] Implement fade-in-up animation variant
- [ ] Implement stagger container/item variants
- [ ] Test animations in both motion and reduced-motion modes
- [ ] Verify animations are interruptible (don't block interaction)

## Testing & Verification

### Unit/Integration Tests

- [ ] Run existing tests: `pnpm run test`
- [ ] Verify all tests pass (no breaking changes)

### E2E Tests

- [ ] Run `tests/e2e/guest/guest-routes.spec.ts`
- [ ] Run `tests/e2e/guest/booking-crud.spec.ts`
- [ ] Run `tests/e2e/guest/profile-crud.spec.ts`
- [ ] Run `tests/e2e/guest/guest-redirects.spec.ts`
- [ ] All E2E tests must pass

### Accessibility Testing

- [ ] Keyboard-only navigation through all pages
- [ ] Tab order is logical
- [ ] Focus indicators visible (`:focus-visible`)
- [ ] Screen reader labels correct (test with VoiceOver/NVDA)
- [ ] Touch targets ≥44px on mobile
- [ ] Color contrast meets WCAG AA (≥4.5:1)

### Performance Testing (per page)

- [ ] Dashboard: FCP ≤2.0s, LCP ≤2.5s, CLS ≤0.10, TBT ≤200ms
- [ ] Bookings: FCP ≤2.0s, LCP ≤2.5s, CLS ≤0.10, TBT ≤200ms
- [ ] Profile: FCP ≤2.0s, LCP ≤2.5s, CLS ≤0.10, TBT ≤200ms
- [ ] Detail: FCP ≤2.0s, LCP ≤2.5s, CLS ≤0.10, TBT ≤200ms
- [ ] Verify no image-induced CLS (images have width/height)

### Visual QA (Chrome DevTools MCP)

- [ ] Mobile (375px) - iPhone SE
- [ ] Tablet (768px) - iPad
- [ ] Desktop (1280px) - Laptop
- [ ] Desktop (1920px) - External monitor
- [ ] Test landscape orientation on mobile
- [ ] Verify no horizontal scrollbars
- [ ] "Stop scrolling" test passed (distinctive, intentional, delightful, accessible)

### Cross-Browser Smoke Test

- [ ] Chrome (primary)
- [ ] Safari (macOS/iOS if available)
- [ ] Firefox (secondary)
- [ ] Edge (tertiary)

## Documentation

- [ ] Update `verification.md` with all test results
- [ ] Attach all Lighthouse JSON files to `artifacts/`
- [ ] Attach all screenshots to `artifacts/`
- [ ] Document any deviations from plan in `verification.md`
- [ ] Update CONTINUITY.md with final state

## Notes & Deviations

### Assumptions

- Existing React Query hooks (`useGuestBookings`, `useGuestProfile`) remain unchanged
- No API contract changes needed
- No database migrations required
- Framer Motion is available (or will use CSS animations as fallback)

### Deviations

- **Dashboard sidebar - Avatar component**: Did not add Avatar component to profile card. Used existing icon approach instead as it's simpler and matches the current design pattern. Avatar component is available if needed for future enhancements.
- **Background texture**: Did not implement noise SVG texture. The warm gradients and layered shadows provide sufficient visual depth without additional texture complexity.

### Implementation Learnings

- (Will document challenges, optimizations, or discoveries here)

## Batched Questions

- Should we add a warm accent color (coral/amber) for CTAs beyond blue? (Deferred - sticking with blue per plan)
- Do guest pages need dark mode support? (No - current scope is light mode only)
- Should empty states include illustrations? (Deferred to v2 - using icons + friendly copy)

---

**Progress Tracking:**

- Total tasks: ~100
- Completed: ~75 (Setup, Design Tokens, Component Variants, Dashboard Complete, Bookings List Complete, Profile Complete, Booking Detail Complete)
- In Progress: None
- Next: Receipt page implementation
- Blocked: None
