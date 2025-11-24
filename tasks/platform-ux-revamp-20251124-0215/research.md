---
task: platform-ux-revamp
timestamp_utc: 2025-11-24T02:15:00Z
owner: github:@amanshresthaa
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Research: Platform-Wide UX/UI Revamp

## Objective

Create a consistent, premium, mobile-first user experience across all guest-facing pages in the Nab a Table platform, maintaining design coherence with the recently improved booking wizard.

## Scope: Pages to Revamp

### Critical Routes (Phase 1 - Priority)

1. **`/` (Landing Page)** - Currently: null render
2. **`/auth/signin`** - Sign-in entry point
3. **`/guest/dashboard`** - Guest home/hub
4. **`/guest/bookings`** - Bookings list
5. **`/thank-you`** - Generic confirmation

### Important Routes (Phase 2)

6. **`/guest/bookings/[bookingId]`** - Manage specific booking
7. **`/bookings/[bookingId]`** - Public booking detail
8. **`/guest/profile`** - Profile & preferences
9. **`/restaurants/[slug]`** - Restaurant profile page

### Confirmation Pages (Phase 3)

10. **`/restaurants/[slug]/book/thank-you`** - Restaurant-specific confirmation
11. **`/bookings/[bookingId]/thank-you`** - Booking-specific confirmation

### Entry Points (Already Enhanced)

- `/restaurants/[slug]/book` - ✅ Booking wizard (recently improved)
- `/item/[slug]` - Restaurant booking entry

## Current State Analysis

### Existing Design System

From recent wizard improvements, we have established:

- **Touch targets**: 44-56px minimum
- **Typography scale**: text-sm → text-base → text-lg with sm: breakpoints
- **Spacing scale**: gap-3, gap-4, gap-5, gap-6
- **Icons**: Lucide icons with h-4 w-4 as baseline
- **Colors**: HSL-based tokens (from `globals.css`)
- **Animations**: 200-300ms compositor-friendly transitions
- **Components**: Shadcn UI library
- **Responsive**: Mobile-first 320px+, breakpoints at 640px (sm), 1024px (lg)

### Current Implementation Status

#### ✅ Well-Implemented

- `/restaurants/[slug]/book` (Booking wizard) - Recently enhanced
- `/thank-you` - Has good structure, needs design polish

#### ⚠️ Basic/Minimal

- `/auth/signin` - Functional but minimal styling
- `/guest/dashboard` - Uses client component (needs review)
- `/guest/bookings` - Exists but needs enhancement
- `/guest/profile` - Exists but needs review

#### ❌ Missing/Stub

- `/` - Returns null (no landing page)
- Several redirect aliases not yet implemented

## Design Principles (Carried Forward)

### 1. Mobile-First

- Design for 320px+, enhance progressively
- Touch targets ≥44px
- Font-size ≥16px for inputs (prevents iOS zoom)
- Thumb-friendly primary actions

### 2. Visual Hierarchy

- Icons for scannability
- Clear headings with proper levels
- Consistent spacing rhythm
- Visual grouping of related info

### 3. Micro-Interactions

- Scale animations on buttons (`active:scale-95`)
- Fade-in for new content
- Smooth transitions (200-300ms)
- Loading states with skeletons

### 4. Accessibility by Default

- WCAG 2.1 AA compliance
- Proper ARIA labels
- Keyboard navigation
- Focus indicators
- Screen reader support

### 5. Performance Budget

- Minimal JavaScript
- Compositor-friendly animations
- Lazy load non-critical
- Core Web Vitals within "Good"

### 6. Consistency

- Reuse wizard components where applicable
- Unified color palette
- Standard spacing/typography
- Predictable patterns

## Component Inventory

### Reusable from Wizard

- `WizardStep` pattern (can adapt to generic "PageSection")
- Icons + labels pattern
- Button styles and states
- Card/grid layouts
- Loading skeletons
- Error/success states

### New Components Needed

- **Hero Section** (for landing page)
- **Feature Cards** (for landing page)
- **Navigation** (guest navbar)
- **Booking Card** (for bookings list)
- **Stats/Summary Cards** (for dashboard)
- **Profile Form** (for profile page)
- **Empty States** (no bookings, etc.)

## Page-Specific Requirements

### 1. `/` (Landing Page)

**Purpose**: First impression, value proposition, quick booking
**Key Elements**:

- Hero with value prop + CTA
- Featured restaurants (if applicable)
- How it works (3-step process)
- Social proof/testimonials (if available)
- Footer with links

**Success Metrics**:

- Conversion to booking wizard
- Time to first interaction

### 2. `/auth/signin`

**Purpose**: Secure, frictionless authentication
**Key Elements**:

- Clean form with email/password
- Magic link option (if enabled)
- Social auth (if enabled)
- "New user?" link
- Redirect handling

**Success Metrics**:

- Completion rate
- Error rate
- Time to sign in

### 3. `/guest/dashboard`

**Purpose**: Hub for guest activity and quick actions
**Key Elements**:

- Welcome message with user name
- Upcoming bookings (next 3)
- Quick actions (new booking, view all)
- Favorites/saved restaurants (future)
- Recent activity

**Success Metrics**:

- Click-through to bookings
- Click-through to new booking
- Return visits

### 4. `/guest/bookings`

**Purpose**: Manage all past and future bookings
**Key Elements**:

- Tabs: Upcoming / Past
- Booking cards with key info
- Status indicators
- Quick actions (view, cancel, modify)
- Empty state for new users
- Search/filter (future)

**Success Metrics**:

- Task completion (cancel, modify)
- Time to find booking

### 5. `/guest/bookings/[bookingId]`

**Purpose**: Detailed view and management of single booking
**Key Elements**:

- Full booking details with icons
- Status badge
- Actions (cancel, modify, download)
- Restaurant info
- Map/directions (future)
- Special requests

**Success Metrics**:

- Action completion rate
- Error rate

### 6. `/guest/profile`

**Purpose**: Manage personal info and preferences
**Key Elements**:

- Profile info (name, email, phone)
- Preferences (dietary, accessibility)
- Notification settings
- Account actions (delete, export)
- Security (change password)

**Success Metrics**:

- Update completion rate
- Error rate

### 7. `/thank-you` (Generic Confirmation)

**Purpose**: Confirm booking success and provide next steps
**Key Elements**:

- Success icon/animation
- Booking reference (prominent)
- Key booking details
- Next steps
- CTA (view booking, new booking)

**Current Implementation**: Good foundation, needs design polish
**Improvements Needed**:

- Better icon/animation
- Consistent card styling
- Enhanced mobile layout
- Better CTA hierarchy

## External Resources & Inspiration

### Design Systems to Reference

1. **Airbnb** (booking flow, confirmation pages)
2. **Resy** (restaurant reservations)
3. **OpenTable** (booking management)
4. **Stripe Checkout** (clean forms)
5. **Linear** (dashboard, cards)

### UI Patterns

- [Shadcn UI Components](https://ui.shadcn.com) - Our component library
- [Tailwind UI](https://tailwindui.com) - Layout patterns
- [Refactoring UI](https://www.refactoringui.com) - Visual design principles

## Constraints

### Technical

- Next.js App Router (Server Components where possible)
- Tailwind CSS (utility-first)
- Shadcn UI components (no custom UI library)
- Supabase auth
- React Query for data fetching

### Design

- Must align with wizard design language
- Mobile-first (320px+)
- Dark mode support
- Accessibility WCAG 2.1 AA

### Business

- No breaking changes to existing APIs
- Maintain SEO (metadata, semantics)
- Support redirect aliases
- Fast iteration (start with high-impact pages)

## Risks

### High Risk

- **Scope creep**: Too many pages to revamp at once
  - **Mitigation**: Phase approach, start with landing + auth
- **Inconsistency**: New pages don't match wizard
  - **Mitigation**: Shared components, design tokens

### Medium Risk

- **Performance regression**: Heavy components
  - **Mitigation**: Server Components, lazy loading
- **Accessibility issues**: Complex interactions
  - **Mitigation**: Testing with axe, screen readers

### Low Risk

- **Dark mode issues**: Inconsistent across pages
  - **Mitigation**: Use design tokens, test both modes

## Open Questions

1. **Landing page content**: Do we have copy/images/branding?
   - **Owner**: Product/Marketing
   - **Due**: Before Phase 1 implementation

2. **Navigation**: Global navbar vs page-specific?
   - **Recommendation**: Guest navbar for logged-in users
   - **Owner**: Design/UX

3. **Feature flags**: Progressive rollout?
   - **Recommendation**: Yes for landing page, optional for others
   - **Owner**: Engineering

4. **Analytics**: What events to track?
   - **Recommendation**: Page views, CTAs, conversions
   - **Owner**: Product

## Recommended Approach

### Phase 1: Foundation (Week 1)

1. Create shared components library (`/components/shared`)
   - PageHero
   - PageSection (adapted from WizardStep)
   - BookingCard
   - StatCard
   - EmptyState
2. Implement `/` (Landing Page)
3. Polish `/auth/signin`
4. Create guest navigation component

### Phase 2: Core Guest Experience (Week 2)

5. Enhance `/guest/dashboard`
6. Revamp `/guest/bookings`
7. Polish `/guest/bookings/[bookingId]`

### Phase 3: Profile & Confirmations (Week 3)

8. Enhance `/guest/profile`
9. Polish `/thank-you` and confirmation pages
10. Implement redirect aliases

### Phase 4: Testing & Polish (Week 4)

11. Cross-browser testing
12. Accessibility audit
13. Performance optimization
14. Documentation

## Success Criteria

- [ ] All pages responsive 320px → 1920px+
- [ ] Lighthouse score ≥90 (mobile & desktop)
- [ ] WCAG 2.1 AA compliance (axe audit passes)
- [ ] Consistent design language across all pages
- [ ] Zero breaking changes to existing functionality
- [ ] Dark mode support on all pages
- [ ] Loading states for all async operations
- [ ] Error states with clear recovery paths
- [ ] User testing with 5+ participants (positive feedback)

## Next Steps

1. Get stakeholder approval on phased approach
2. Finalize landing page content/copy
3. Create component library (shared)
4. Start Phase 1 implementation
