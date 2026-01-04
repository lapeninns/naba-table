---
task: user-role-selection-page
timestamp_utc: 2026-01-04T10:31:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: User Role Selection Page

## Objective

Create a user-friendly role selection page that divides traffic between guests (bookers) and restaurant owners (managers) before signin, improving conversion and reducing user confusion.

## Success Criteria

- [ ] Role selection page loads < 2s (4G mobile)
- [ ] Both roles accessible via keyboard navigation
- [ ] Authenticated users automatically redirected to correct dashboard
- [ ] Screen reader announces roles clearly (WCAG AA)
- [ ] Works without JavaScript (progressive enhancement)
- [ ] Role preference remembered in localStorage (30-day expiry)
- [ ] No breaking changes to existing auth flow

## Architecture & Components

### New Component Structure

```
src/app/(public)/auth/
├── page.tsx                 # NEW: Role selection page (replaces signin entry)
├── signin/
│   └── page.tsx            # EXISTING: Modified to accept ?role= param
└── signup/
    └── page.tsx            # EXISTING: May be updated in future
```

### Page Layout

```
┌─────────────────────────────────────────┐
│         [Logo] [Sign In Link]        │ ← Existing navbar (or reuse)
├─────────────────────────────────────────┤
│                                     │
│  Choose your path                   │ ← h1
│  We help both guests and venues     │ ← Supporting text
│                                     │
│  ┌─────────────────┐ ┌──────────┐  │
│  │ 👤 GUEST        │ │ 🏢 OWNER │  │ ← Two equal cards
│  │ [Icon]         │ │ [Icon]   │  │
│  │                │ │           │  │
│  │ Book tables    │ │ Manage    │  │
│  │ Browse venues │ │ bookings   │  │
│  │ Track        │ │ Analytics  │  │
│  │ reservations  │ │ Revenue    │  │
│  │                │ │           │  │
│  │ [Browse       │ │ [Sign in  │  │ ← Primary CTAs
│  │  Restaurants] │ │  to Owner│  │
│  └─────────────────┘ └──────────┘  │
│                                     │
│  Not sure? Start as a guest to       │ ← Helper text
│  browse restaurants first            │
│                                     │
└─────────────────────────────────────────┘
```

## Data Flow & API Contracts

### Server-side Auth Check

```typescript
// src/app/(public)/auth/page.tsx
const supabase = await getServerComponentSupabaseClient();
const {
  data: { user },
} = await supabase.auth.getUser();

if (user) {
  // Check user metadata for role
  const userRole = user.user_metadata?.role;

  if (userRole === 'owner') {
    redirect('/owner/dashboard');
  } else {
    redirect('/guest/dashboard');
  }
}
```

### Client-side Selection

```typescript
// On role card click
const handleGuestSelect = () => {
  localStorage.setItem('preferred-role', 'guest', { expires: 30 });
  router.push('/guest/dashboard'); // Or /auth/signin?role=guest
};

const handleOwnerSelect = () => {
  localStorage.setItem('preferred-role', 'owner', { expires: 30 });
  router.push('/auth/signin?role=owner');
};
```

## UI/UX States

### Loading States

- Page: Minimal (server-side, no data fetching)
- Card hover: Subtle lift animation
- Redirect: Instant (no loading state needed)

### Error States

- None expected (static page, no API calls)

### Interactive States

- Card focus: Visible focus ring
- Card hover: Slight lift, shadow increase
- Card click: Navigate to appropriate route
- "Not sure" link: Navigate to guest flow

## Edge Cases

1. **User already signed in**: Auto-redirect to their dashboard based on user_metadata.role
2. **No role in metadata**: Default to guest dashboard, prompt to claim ownership if applicable
3. **Mobile device (< 375px)**: Stack cards vertically, maintain touch targets (44px)
4. **JavaScript disabled**: Cards use `<a>` tags for navigation (progressive enhancement)
5. **Screen reader**: Clear heading hierarchy (h1 → h2 for each role)
6. **Keyboard navigation**: Tab through cards, Enter/Space to select
7. **Bookmark old `/auth/signin`**: Keep existing route working, add "Choose role" option

## Testing Strategy

### Unit Tests

- RoleCard renders with correct props
- Role card click redirects to correct URL
- localStorage preference saved with 30-day expiry
- Authenticated user redirect logic works

### Integration Tests

- Role selection page renders without errors
- Authenticated users redirected to correct dashboard
- Unauthenticated users see role cards
- Links navigate to correct routes

### E2E Tests (Playwright)

- Guest user flow: Select guest → Browse restaurants
- Owner user flow: Select owner → Sign in → Dashboard
- Keyboard navigation: Tab through cards → Enter to select
- Mobile flow: Touch cards on 375px device

### Accessibility Tests

- Axe DevTools: 0 critical/serious issues
- Keyboard-only: Both cards accessible via Tab + Enter
- Screen reader: "Guest card, link" and "Owner card, link" announced
- Focus management: No focus traps
- Color contrast: WCAG AA (4.5:1)

### Performance Tests

- Lighthouse score: Performance ≥ 90, Accessibility ≥ 95
- LCP: < 2s (4G, mobile)
- Bundle size: < 50KB gzipped (no new dependencies)

## Rollout

### No Feature Flag Needed

This is a non-breaking change:

- New route: `/auth` (role selection)
- Existing routes: `/auth/signin`, `/auth/signup` still work
- Gradual adoption: Update marketing links to point to `/auth` first

### Monitoring

- Track role selection events via Clarity:
  - `role_selected: { role: 'guest' | 'owner' }`
- Track conversion funnel:
  - `/auth` → role selection → `/auth/signin` → success
- Monitor bounce rate on role page
- Track time spent on page before selection

### Kill-switch

Revert marketing links to `/auth/signin` if conversion rate drops > 20%.

## DB Change Plan

**No database changes required.** Uses existing Supabase auth metadata.

## File Changes

### New Files

```
src/app/(public)/auth/page.tsx        # Role selection page
src/components/auth/RoleCard.tsx         # Reusable role card component
```

### Modified Files

```
src/app/(public)/auth/signin/page.tsx  # Optional: Accept ?role= param for future
README.md                               # Document new route
```

## Performance Budgets

### Critical Resources

- First Contentful Paint (FCP): ≤ 1.5s (static page)
- Largest Contentful Paint (LCP): ≤ 2.0s (hero image/text)
- Cumulative Layout Shift (CLS): ≤ 0.05 (no shifting cards)
- Total Blocking Time (TBT): ≤ 50ms (minimal JS)

### Bundle Size

- Initial JS: ≤ 50KB (gzipped)
- Total CSS: ≤ 10KB (gzipped, reuse existing tokens)

## Accessibility Checklist

- [ ] Skip link to main content (if using existing layout)
- [ ] Single `<h1>`: "Choose your path"
- [ ] Two `<h2>`: "For Guests", "For Restaurant Owners"
- [ ] Role cards are `<a>` or `<button>` with clear labels
- [ ] Icons have `aria-hidden="true"` (decorative)
- [ ] Focus indicators visible (`:focus-visible`)
- [ ] Color contrast ≥ 4.5:1 (all text)
- [ ] Touch targets ≥ 44×44px (mobile)
- [ ] Reduced motion respected (no unnecessary animations)
- [ ] ARIA landmarks: `<main>`, `<nav>` (if present)
- [ ] Keyboard navigation works (Tab, Enter, Space)

## Security Considerations

- No new secrets or API keys
- No user input validation needed (selection only)
- Safe redirects (no open redirect vulnerabilities)
- localStorage is client-side only (no sensitive data)

## Content & Copy

### Guest Card

- **Heading**: "For Guests"
- **Body**: "Book tables at top restaurants, track reservations, and manage your bookings."
- **CTA**: "Browse Restaurants" → `/guest/dashboard` or `/restaurants`

### Owner Card

- **Heading**: "For Restaurant Owners"
- **Body**: "Manage bookings, fill empty tables, and increase revenue with automation."
- **CTA**: "Sign in as Owner" → `/auth/signin?role=owner`

### Helper Text

- "Not sure which to choose? Start as a guest to browse restaurants first."

## SEO & Routing

### Meta Tags

```typescript
export const metadata: Metadata = {
  title: 'Sign In or Book a Table - Nab a Table',
  description: 'Choose your path: Book a table as a guest or manage your restaurant as an owner.',
  robots: 'noindex, nofollow', // Don't index role selection page
};
```

### Routing Updates

- Update marketing links:
  - Old: `/auth/signin` → New: `/auth`
  - Old: `/guest/dashboard` → Keep
  - Old: `/owner/dashboard` → Keep
- Update email templates (if any) to use `/auth`

## Documentation Updates

- Update route-map.md with new `/auth` route
- Update AGENTS.md if new patterns introduced
- Add screenshots to task folder after implementation
- Update README.md with new entry point description
