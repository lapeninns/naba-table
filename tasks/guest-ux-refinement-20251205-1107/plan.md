# Implementation Plan: Guest-Facing UX/UI Refinement

## Objective

Bring all guest-facing pages to a polished, production-ready level with clarity, consistency, accessibility, and a cohesive visual language.

## Success Criteria

- [ ] Consistent spacing tokens used across all guest pages
- [ ] Clear typography hierarchy with defined scale
- [ ] Unified component styling (cards, buttons, forms)
- [ ] All interactive elements have proper hover/focus/active states
- [ ] WCAG AA compliance verified
- [ ] Responsive design verified at 375px, 768px, 1280px+
- [ ] Build succeeds with no TypeScript errors
- [ ] FCP ≤ 2.0s, LCP ≤ 2.5s, CLS ≤ 0.10

## Architecture & Components

### Design Token Updates (globals.css)

Add standardized guest-specific design tokens:

```css
/* Guest Section Spacing */
--guest-section-gap: 3rem; /* 48px - between sections */
--guest-section-padding: 2rem; /* 32px - inside sections */
--guest-card-gap: 1.5rem; /* 24px - between cards */
--guest-card-padding: 1.5rem; /* 24px - inside cards */

/* Guest Typography */
--guest-heading-page: 2.25rem; /* 36px */
--guest-heading-section: 1.5rem; /* 24px */
--guest-heading-card: 1.125rem; /* 18px */
--guest-body: 1rem; /* 16px */
--guest-caption: 0.875rem; /* 14px */
--guest-micro: 0.75rem; /* 12px */

/* Guest Borders & Shadows */
--guest-radius-sm: 0.5rem; /* 8px */
--guest-radius-md: 0.75rem; /* 12px */
--guest-radius-lg: 1rem; /* 16px */
--guest-radius-xl: 1.5rem; /* 24px */
--guest-radius-full: 9999px;
```

### GuestPrimitives Updates

- Standardize `GuestSection` padding variants
- Add consistent transition timing
- Normalize border-radius usage

### Layout Updates

- Standardize container max-width: `max-w-6xl` everywhere
- Normalize main content padding
- Consistent footer spacing

## Page-by-Page Refinements

### 1. Landing Page (`/`)

- [x] Using GuestHero, GuestSection, GuestCard properly
- [ ] Standardize section gaps to consistent spacing
- [ ] Unify button styles (all CTAs rounded-full)
- [ ] Ensure proper heading hierarchy (h1, h2, h3)

### 2. Restaurants List (`/restaurants`)

- [ ] Same section spacing as landing page
- [ ] Consistent card hover effects
- [ ] Unified image placeholder styling

### 3. Restaurant Detail (`/restaurants/[slug]`)

- [ ] Hero image gradient standardization
- [ ] Contact card consistency
- [ ] Booking CTA prominence
- [ ] Section spacing alignment

### 4. Booking Wizard (`/restaurants/[slug]/book`)

- [ ] Wrapper styling consistency
- [ ] Form field standardization
- [ ] Progress indicator styling

### 5. Thank-You Page

- [ ] Consistent with guest theme
- [ ] Button styling alignment
- [ ] Animation refinement

### 6. Sign-In Page (`/auth/signin`)

- [ ] Card border/shadow consistency
- [ ] Form field styling
- [ ] Link styling standardization

### 7. Dashboard (`/guest/dashboard`)

- [ ] Section spacing normalization
- [ ] Card variant consistency
- [ ] Quick action card refinement
- [ ] Featured booking card polish

### 8. Bookings List (`/guest/bookings`)

- [ ] Replace inline EmptyTabState with GuestEmptyState
- [ ] Tab styling consistency
- [ ] Booking card standardization

### 9. Profile Page (`/guest/profile`)

- [ ] Header animation consistency
- [ ] Status cards alignment
- [ ] Form styling standardization

## Testing Strategy

- Visual verification via browser at each breakpoint
- Build verification after each change batch
- Keyboard navigation testing
- Screen reader testing with VoiceOver

## Rollout

- Incremental changes, verifying build after each
- No feature flags needed (CSS/styling only)
- All changes backwards compatible
