---
task: user-role-selection-page
timestamp_utc: 2026-01-04T10:31:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: User Role Selection Page

## Requirements

### Functional

- Create a role selection page that appears before signin
- Two main user paths:
  1. **Guest**: "I want to book a table" → routes to `/auth/signin?role=guest` or `/guest/dashboard` (if authenticated)
  2. **Restaurant Owner**: "I manage a restaurant" → routes to `/auth/signin?role=owner` or `/owner/dashboard` (if authenticated)
- Clear visual distinction between the two options
- Mobile-first responsive design
- Support keyboard navigation and screen readers

### Non-functional (a11y, perf, security, privacy, i18n)

- WCAG 2.1 AA compliance (keyboard navigation, ARIA labels, focus management)
- Fast load time (< 2s LCP, 4G mobile)
- No new PII or sensitive data collection
- Prepare copy for future localization
- Respect prefers-reduced-motion

## Existing Patterns & Reuse

### Current Signin Flow

- `src/app/(public)/auth/signin/page.tsx` - Existing signin page
- `src/app/(public)/auth/signup/page.tsx` - Existing signup page
- `src/components/layouts/AuthLayout.tsx` - Auth layout wrapper

### Navigation Routes

- Guest paths: `/guest/dashboard`, `/guest/bookings`, `/restaurants`
- Owner paths: `/owner/dashboard`, `/app` (owner app)
- Marketing paths: `/`, `/contact`, `/demo`

### Shadcn Components Available

- `Button` - Primary and secondary variants
- `Card` - For role selection cards
- `Badge` - For labels/badges
- `Icon` - For visual indicators

### Design System

- Guest theme: Blue accent, calm layout
- Owner theme: Distinct visual language (if applicable)
- Shared tokens: `--guest-radius-*`, `--shadow-card`

## Constraints & Risks

### Constraints

- Must preserve existing authentication flow (no breaking changes)
- Must support existing URL query params (e.g., `?redirect_to=`)
- Cannot introduce new authentication logic (frontend routing only)
- Must work without JavaScript (progressive enhancement)
- Time constraint: Complete within 2 hours

### Risks

- **User Confusion**: Users might not understand which role to select
- **SEO Impact**: New entry point could dilute SEO signals
- **Breaking Change**: Existing bookmarked `/auth/signin` links should still work
- **Mobile UX**: Cards may stack awkwardly on small screens
- **Accessibility**: Screen reader may not distinguish options clearly

**Mitigation**:

- Clear, descriptive copy with icons
- Keep `/auth/signin` as fallback route
- Add helper text: "Not sure? Choose guest to browse restaurants"
- Test on real devices (375px, 768px, 1280px+)
- Use proper heading hierarchy and ARIA landmarks

## External Resources

- [Sign-in UX Patterns (Nielsen Norman)](https://www.nngroup.com/articles/designing-web-sign-in-flow/) - Best practices for signin flows
- [Role-based routing examples](https://uxdesign.cc/ux-pattern-role-based-navigation/) - Role-based navigation patterns
- [Multi-product landing pages](https://www.smashingmagazine.com/2022/01/improve-conversion-with-multi-product-landing-pages/) - Conversion optimization

## Open Questions

- Q: Should this replace `/` landing page or be a new route like `/choose-role`?
  A: Create new route `/auth` as entry point, keep `/` as marketing landing for demo requests

- Q: How to handle users who are already signed in?
  A: Auto-redirect to their appropriate dashboard based on user metadata

- Q: Should we remember user's role preference?
  A: Use localStorage for returning visitors (30-day expiry)

- Q: What if user selects wrong role after signin?
  A: Add "Switch role" link in respective dashboards

## Recommended Direction

1. **Create role selection page** at `src/app/(public)/auth/page.tsx` with two large cards
2. **Client-side redirect**: On selection, redirect to appropriate signin with query param
3. **Server-side redirect**: In `page.tsx`, check auth and redirect authenticated users to their dashboard
4. **Visual design**:
   - Guest card: Blue theme, booking-related icon
   - Owner card: Green/amber theme, restaurant-related icon
   - Equal size cards, prominent CTAs
   - Helper text below cards
5. **Accessibility**:
   - Each card is a focusable link or button
   - Clear heading hierarchy: h1 "Choose your path" → h2 for each role
   - ARIA labels for icons
   - Keyboard navigation (Tab, Enter, Space)

**Success Criteria**:

- [ ] Role page loads < 2s (4G mobile)
- [ ] Users can select role with keyboard only
- [ ] Authenticated users redirected to correct dashboard
- [ ] Screen reader announces role options clearly
- [ ] Works without JavaScript (progressive enhancement)
