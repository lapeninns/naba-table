---
task: guest-ui-revamp
timestamp_utc: 2026-01-05T00:03:00Z
owner: github:@ai-agent
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Guest UI/UX Revamp

## Objective

We will enable **guests** to **experience a distinctive, premium, and trustworthy booking portal** so that **they feel confident managing their reservations and prefer our platform over competitors**.

## Success Criteria

- [ ] All guest pages (`/guest/*`) have consistent visual language
- [ ] Lighthouse Performance ≥ 90, Accessibility = 100 on all pages
- [ ] Axe DevTools reports 0 critical/serious accessibility issues
- [ ] Core Web Vitals: FCP ≤2.0s, LCP ≤2.5s, CLS ≤0.10, TBT ≤200ms (mobile, 4× CPU, 4G)
- [ ] Visual QA: Passes "stop scrolling" test (not generic AI slop)
- [ ] Zero breaking changes to existing user flows
- [ ] All E2E tests pass (`tests/e2e/guest/*.spec.ts`)

## Architecture & Components

### Design System Updates

**1. Color Tokens (extend `styles/themes/guest.css`)**

```css
.guest-theme {
  /* Warm neutrals for backgrounds */
  --color-surface-warm: #fefdfb; /* Cream white */
  --color-surface-elevated: #ffffff; /* Pure white for cards */
  --color-surface-muted: #f8f7f5; /* Off-white for subtle sections */

  /* Enhanced blue scale (keep existing) */
  --primary: 217 91% 60%; /* blue-500 - primary CTAs */
  --primary-hover: 217 91% 55%; /* Slightly darker on hover */

  /* Shadows (layered depth) */
  --shadow-card:
    0 1px 2px hsl(217 19% 27% / 0.04), 0 4px 8px hsl(217 19% 27% / 0.04),
    0 16px 32px hsl(217 19% 27% / 0.04);

  --shadow-card-hover:
    0 2px 4px hsl(217 19% 27% / 0.06), 0 8px 16px hsl(217 19% 27% / 0.06),
    0 24px 48px hsl(217 19% 27% / 0.06);

  /* Motion */
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}
```

**2. Typography Enhancements**

```css
.guest-theme {
  /* Hero sections - larger, bolder */
  .heading-hero {
    font-size: clamp(2.5rem, 5vw, 3.5rem);
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.1;
  }

  /* Section titles */
  .heading-section {
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    line-height: 1.2;
  }

  /* Body with warmth */
  .text-body-warm {
    font-size: 1rem;
    font-weight: 400;
    line-height: 1.6;
    color: hsl(217 19% 35%); /* Softer than pure black */
  }
}
```

**3. Background Texture (noise overlay)**

```css
.guest-theme .bg-surface-textured {
  background-color: var(--color-surface-warm);
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  background-blend-mode: soft-light;
  background-size: 200px;
  opacity: 0.03;
}
```

### Shadcn Components (via MCP)

**Components to Add:**

1. **Card** - Already exists, add variants:
   - `variant="featured"` - Large hero card (dashboard featured booking)
   - `variant="interactive"` - Hover lift effect
   - `variant="compact"` - List items

2. **Badge** - Already exists, add variants:
   - `variant="status-confirmed"` - Green
   - `variant="status-pending"` - Amber
   - `variant="status-completed"` - Slate
   - `variant="metric"` - Stat pills (Upcoming, Favorites)

3. **Tabs** - Add for bookings page (upcoming/past/cancelled)

4. **Avatar** - User profile icon (sidebar, navbar)

5. **Separator** - Visual dividers between sections

**No Custom Primitives** - All components extend Shadcn base

### Page-Level Architecture

**1. Dashboard (`/guest/dashboard`)**

**Current:** `GuestDashboardClient.tsx`

**Changes:**

- **Hero section:**
  - Replace `bg-gradient-to-r from-blue-50 to-white` with warm textured background
  - Increase padding (py-10 → py-16 on desktop)
  - Enhance typography (use `.heading-hero` for greeting)
- **Featured booking card:**
  - Use Shadcn Card `variant="featured"`
  - Add subtle hover lift (`hover:-translate-y-1`)
  - Improve QR code section contrast
- **Upcoming list:**
  - Standardize with Card `variant="interactive"`
  - Add staggered entrance animation (framer-motion or CSS)
- **Sidebar:**
  - Use Card for stats/favorites/profile sections
  - Add Avatar component for profile icon
  - Increase touch targets (buttons ≥ 48px on mobile)

**2. Bookings List (`/guest/bookings`)**

**Current:** `GuestBookingsPageView.tsx` (assumed, need to verify)

**Changes:**

- Add Shadcn Tabs for navigation (upcoming/past/cancelled)
- Standardize booking cards (same as dashboard upcoming)
- Empty state: Add personality (icon, friendly copy)
- Loading state: Consistent skeleton grid

**3. Profile (`/guest/profile`)**

**Current:** `GuestProfilePageView.tsx`

**Changes:**

- Form fields: Ensure inputs ≥16px on mobile (prevent zoom)
- Use Shadcn Separator between sections
- Add Toast notifications for save success/error
- Profile header: Add Avatar with initials/photo

**4. Individual Booking (`/guest/bookings/[id]`)**

**Changes:**

- Generous white space (max-w-3xl centered)
- Detail sections in Cards
- Action buttons (Cancel, Modify) with clear states
- Receipt link prominent

**5. Receipt (`/guest/bookings/[id]/receipt`)**

**Changes:**

- Print-friendly styling (`@media print`)
- Clean, structured layout
- QR code for check-in

**6. Thank You (`/guest/thank-you`)**

**Changes:**

- Celebratory design (success green accent)
- Clear next steps
- Link back to dashboard

### Component Hierarchy

```
GuestLayout
├── GuestNavbar (existing, minor style updates)
├── GuestBackground (update texture)
└── main
    └── Page-specific view
        ├── Hero Section (warm gradient, enhanced typography)
        ├── Content Grid
        │   ├── Card (featured/interactive/compact variants)
        │   ├── Badge (status/metric variants)
        │   ├── Button (primary/secondary/ghost)
        │   └── Tabs (bookings page)
        └── Sidebar
            ├── Avatar
            ├── Card (stats, favorites, profile)
            └── Separator
```

### State Management

**No changes to state management** - React Query hooks remain unchanged:

- `useGuestBookings()`
- `useGuestProfile()`
- `useGuestSession()`

**State reflected in URL:**

- Bookings page: `?tab=upcoming|past|cancelled`

## Data Flow & API Contracts

**No API changes** - All existing endpoints remain:

- `GET /api/guest/bookings`
- `GET /api/guest/profile`
- `PATCH /api/guest/profile`
- `GET /api/guest/bookings/[id]`

**Client-side derivations** (existing):

- `deriveBookingState()` - Live/next booking, favorites
- View models: `buildGuestDashboardViewModel()`, etc.

## UI/UX States

### Loading

- Skeleton screens (Shadcn Skeleton)
- Consistent across all pages
- Preserve layout (prevent CLS)

### Empty

- Dashboard: No bookings → Hero CTA to browse restaurants
- Bookings list: No items in tab → Friendly message + CTA
- Profile: Always has data (user session)

### Error

- `GuestError` component (existing)
- Retry button
- Friendly copy ("We couldn't load...")

### Success

- Dashboard: Featured booking + upcoming list
- Bookings: Tab grid with cards
- Profile: Editable form with save feedback (Toast)

## Edge Cases

1. **Very long restaurant names**
   - Truncate with ellipsis (`truncate` utility)
   - Show full name in tooltip on hover

2. **Large party sizes (>10 people)**
   - Display as "10+ guests"

3. **Bookings on same day**
   - "Happening today" badge (existing)
   - Sort by time (earliest first)

4. **No favorites**
   - Hide favorites card (existing behavior)

5. **Mobile landscape orientation**
   - Ensure touch targets still ≥ 44px
   - Test hero section doesn't overflow

6. **Slow network (4G)**
   - Show loading skeletons immediately
   - Progressive enhancement (content first, animations second)

## Testing Strategy

### Unit Tests

- **Existing tests pass:** `tests/server/guest/*.test.ts`
- **New tests:** None required (UI-only changes)

### Integration Tests

- **Existing tests pass:** `tests/server/guest/*.test.tsx`
- **Component tests:** Verify new Card/Badge variants render correctly

### E2E Tests

- **Must pass:** All `tests/e2e/guest/*.spec.ts`
  - `guest-routes.spec.ts` - Navigation
  - `booking-crud.spec.ts` - Booking interactions
  - `profile-crud.spec.ts` - Profile editing
  - `guest-redirects.spec.ts` - Auth flows

- **New scenarios:**
  - Keyboard navigation through dashboard cards
  - Tab navigation on bookings page
  - Toast appears on profile save

### Accessibility Tests

- **Axe DevTools:** Run on every page
- **Keyboard-only:** Navigate entire flow without mouse
- **Screen reader:** VoiceOver (macOS) or NVDA (Windows)
- **Focus management:** Visible indicators, logical order

### Performance Tests

- **Lighthouse:** Mobile simulation, 4× CPU, 4G throttling
- **Budgets:**
  - FCP ≤ 2.0s
  - LCP ≤ 2.5s
  - CLS ≤ 0.10
  - TBT ≤ 200ms

### Visual QA

- **Device emulation (Chrome DevTools MCP):**
  - Mobile: 375px (iPhone SE)
  - Tablet: 768px (iPad)
  - Desktop: 1280px, 1920px (laptop, external monitor)
- **"Stop scrolling" test:**
  - Distinctive? (Not generic blue gradient + Inter font)
  - Intentional? (Every color/shadow/spacing justified)
  - Delightful? (Micro-interactions, warm feel)
  - Accessible? (WCAG AA, keyboard, screen reader)

## Rollout

**No feature flags needed** - UI-only changes, no behavioral changes

**Deployment:**

1. **Staging:** Deploy branch, manual QA
2. **Production:** Deploy via standard CI/CD
3. **Monitoring:** Watch error rates, page load times (no expected changes)

**Kill-switch:**

- If critical issues: Revert commit
- If minor issues: Hot-fix in place

**Metrics to watch:**

- Error rate (should stay flat)
- Page load metrics (should improve or stay flat)
- User engagement (subjective, not measurable short-term)

## DB Change Plan

**No database changes** - UI-only update

## Animation Strategy

### Entrance Animations (Dashboard)

**Featured booking card:**

```tsx
// Framer Motion variant
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};
```

**Upcoming list (staggered):**

```tsx
const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};
```

**Respect `prefers-reduced-motion`:**

```tsx
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const variants = prefersReducedMotion
  ? { initial: {}, animate: {} } // No animation
  : fadeInUp;
```

### Hover Interactions

**Cards:**

```css
.card-interactive {
  transition:
    transform var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-normal) var(--ease-out);
}

.card-interactive:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-card-hover);
}

@media (prefers-reduced-motion: reduce) {
  .card-interactive {
    transition: none;
  }
  .card-interactive:hover {
    transform: none;
  }
}
```

**Buttons:**

```css
.button-primary {
  transition: background-color var(--duration-fast) var(--ease-out);
}

.button-primary:hover {
  background-color: hsl(var(--primary-hover));
}
```

## File Changes Summary

### New Files

- `styles/themes/guest-enhanced.css` - Extended design tokens
- `src/components/ui/card-variants.tsx` - Card variant definitions (if needed beyond Shadcn config)

### Modified Files

- `src/components/features/guest/dashboard/GuestDashboardClient.tsx` - Hero, cards, animations
- `src/guest/routes/dashboard/page-view.tsx` - Pass enhanced props
- `src/guest/routes/bookings/page-view.tsx` - Add Tabs, standardize cards
- `src/guest/routes/profile/page-view.tsx` - Form styling, Toast
- `src/app/guest/bookings/[bookingId]/page.tsx` - Detail page layout
- `src/app/guest/bookings/[bookingId]/receipt/ReceiptClient.tsx` - Print styles
- `src/app/guest/thank-you/page.tsx` - Celebratory design
- `src/components/layouts/GuestLayout.tsx` - Background texture update
- `src/components/layouts/GuestBackground.tsx` - Warm gradient
- `styles/themes/guest.css` - Add new tokens

### Shadcn Commands (via MCP or CLI)

```bash
npx shadcn@latest add tabs
npx shadcn@latest add avatar
npx shadcn@latest add separator
npx shadcn@latest add toast
# Card, Badge, Button already exist
```

## Verification Plan

### Pre-Implementation

- [x] Research complete (research.md)
- [x] Plan reviewed (this document)
- [ ] Shadcn components available (check MCP)
- [ ] Design tokens defined

### During Implementation

- [ ] Each page passes visual QA (screenshots in artifacts/)
- [ ] Lighthouse runs after each page (JSON in artifacts/)
- [ ] Keyboard navigation tested
- [ ] E2E tests pass

### Post-Implementation

- [ ] All pages deployed to staging
- [ ] Chrome DevTools MCP full audit (artifacts/)
- [ ] Axe DevTools 0 critical/serious
- [ ] Performance budgets met
- [ ] "Stop scrolling" test passed

## Next Steps

1. **Proceed to Phase 3 (Implementation):**
   - Create `todo.md` with atomic checklist
   - Start with design token updates
   - Implement dashboard (highest visibility)
   - Then bookings → profile → detail pages

2. **Use Shadcn MCP:**
   - Query available components
   - Add Tabs, Avatar, Separator, Toast
   - Configure variants

3. **Continuous verification:**
   - Run Lighthouse after each page
   - Test keyboard nav after each component
   - Capture artifacts in `artifacts/`

4. **Phase 4 (Verification):**
   - Full Chrome DevTools MCP audit
   - Cross-browser smoke test
   - Sign-off checklist in `verification.md`
