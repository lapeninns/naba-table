---
task: user-role-selection-page
timestamp_utc: 2026-01-04T10:31:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Create task folder and artifacts directory
- [ ] Review existing auth routes (`/auth/signin`, `/auth/signup`)
- [ ] Check existing auth layout components
- [ ] Review guest/owner dashboard routes

## Phase 1: Component Creation

### Role Card Component

- [ ] Create `src/components/auth/RoleCard.tsx` component
- [ ] Support both guest and owner variants via props
- [ ] Add icon support (Lucide icons)
- [ ] Implement hover/focus states
- [ ] Add loading animation support (if needed)
- [ ] Make accessible (ARIA labels, keyboard)
- [ ] Support `<a>` and `<button>` variants

### Main Page Component

- [ ] Create `src/app/(public)/auth/page.tsx`
- [ ] Add server-side auth check
- [ ] Implement redirect logic for authenticated users
- [ ] Add client-side role selection handlers
- [ ] Implement localStorage preference saving (30-day expiry)
- [ ] Add "Not sure?" helper text/link

## Phase 2: UI/UX

### Visual Design

- [ ] Design two equal-sized role cards
- [ ] Use distinct colors for guest (blue) vs owner (green/amber)
- [ ] Add icons: `Users` (guest) vs `Building2` (owner)
- [ ] Implement card hover animation (lift + shadow)
- [ ] Add focus ring on keyboard navigation
- [ ] Ensure responsive layout (stack on mobile, side-by-side on desktop)

### Copy & Content

- [ ] Write clear heading: "Choose your path"
- [ ] Add supporting description
- [ ] Craft guest card copy (benefits-focused)
- [ ] Craft owner card copy (value-focused)
- [ ] Add helper text for unsure users
- [ ] Ensure all copy is concise (< 80 chars per line)

## Phase 3: Accessibility

### Screen Reader Support

- [ ] Add proper heading hierarchy (h1 → h2)
- [ ] Add ARIA labels to decorative icons
- [ ] Ensure cards are announced as links/buttons
- [ ] Add skip links (if not in layout)
- [ ] Test with NVDA/VoiceOver

### Keyboard Navigation

- [ ] Tab through both cards
- [ ] Enter/Space to select role
- [ ] Focus visible on active card
- [ ] No focus traps
- [ ] Escape key does nothing (no modal)

### Reduced Motion

- [ ] Disable hover animations with `prefers-reduced-motion`
- [ ] No auto-playing animations
- [ ] Respect user preferences

## Phase 4: Routing & Auth

### Server-side Redirects

- [ ] Check `user.user_metadata.role` for authenticated users
- [ ] Redirect to `/guest/dashboard` for guests
- [ ] Redirect to `/owner/dashboard` for owners
- [ ] Default to guest if role unknown
- [ ] Test redirect flow (guest, owner, no role)

### Client-side Selection

- [ ] Guest selection: Navigate to `/guest/dashboard` or `/auth/signin?role=guest`
- [ ] Owner selection: Navigate to `/auth/signin?role=owner`
- [ ] Save `localStorage.setItem('preferred-role', role, { expires: 30 })`
- [ ] On page load, check for saved preference
- [ ] Pre-select role card if preference exists

### Existing Route Compatibility

- [ ] Verify `/auth/signin` still works directly
- [ ] Verify `/auth/signup` still works directly
- [ ] Add "Choose your role" link to signin page (optional)
- [ ] Test bookmark flow to old routes

## Phase 5: Testing

### Unit Tests

- [ ] Test RoleCard renders with guest props
- [ ] Test RoleCard renders with owner props
- [ ] Test role card click handler
- [ ] Test localStorage preference saving
- [ ] Test localStorage preference loading
- [ ] Test localStorage expiry logic

### Integration Tests

- [ ] Test unauthenticated user sees role selection
- [ ] Test guest user redirects to guest dashboard
- [ ] Test owner user redirects to owner dashboard
- [ ] Test role selection navigates to correct URL
- [ ] Test "Not sure?" link navigates to guest flow

### E2E Tests (Playwright)

- [ ] Test guest user flow: Select guest → Browse
- [ ] Test owner user flow: Select owner → Sign in → Dashboard
- [ ] Test keyboard navigation: Tab through cards
- [ ] Test mobile flow: Touch on 375px device
- [ ] Test return visitor: Pre-selected card from localStorage

### Accessibility Tests

- [ ] Run axe DevTools audit
- [ ] Fix all critical/serious issues
- [ ] Test with screen reader (NVDA/VoiceOver)
- [ ] Verify color contrast (4.5:1)
- [ ] Test zoom 200% (WCAG AA)
- [ ] Test with reduced motion preference

### Performance Tests

- [ ] Run Lighthouse audit (mobile 4G)
- [ ] Verify LCP ≤ 2.0s
- [ ] Measure bundle size (< 50KB gzipped)
- [ ] Test on real devices (iPhone, Android)

## Phase 6: Deployment

### Pre-deployment

- [ ] Run all tests: `pnpm run test`
- [ ] Run linter: `pnpm run lint`
- [ ] Run typecheck: `pnpm run typecheck`
- [ ] Run E2E tests: `pnpm run test:e2e`
- [ ] Manual QA of role selection flow
- [ ] Verify redirect logic works correctly

### Rollout

- [ ] Merge to main branch
- [ ] Deploy to production (no flag needed)
- [ ] Monitor role selection events in Clarity
- [ ] Monitor conversion funnel metrics
- [ ] Check bounce rate on role page
- [ ] Monitor for 24 hours

### Post-deployment

- [ ] Update marketing links to point to `/auth`
- [ ] Update email templates (if any)
- [ ] Update route-map.md documentation
- [ ] Capture screenshots of role page
- [ ] Document any issues in verification.md

## Phase 7: Cleanup & Documentation

- [ ] Add inline comments where needed
- [ ] Update README.md with new route
- [ ] Update route-map.json (if exists)
- [ ] Add screenshots to artifacts folder
- [ ] Update CONTINUITY.md
- [ ] Close related issues (if any)

## Notes

- Assumptions:
  - User role stored in `user.user_metadata.role` (may need to verify)
  - No existing role selection UI to replace
  - Guest users can browse without signing in
  - Owner users must sign in to access dashboard

- Deviations:
  - Initially considered `/choose-role` route, but `/auth` is cleaner
  - May add third role (admin) in future if needed

## Batched Questions

- Should we add a third role for "Event Planner"?
- Should we remember role preference in cookie instead of localStorage?
- What's the current user_metadata structure for roles?
- Should we show role selection to authenticated users who have no role set?
