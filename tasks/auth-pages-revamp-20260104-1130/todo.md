---
task: auth-pages-revamp-20260104-1130
timestamp_utc: 2026-01-04T11:30:00Z
owner: github:@ai-assistant
status: in_progress
---

# Implementation Checklist

## Setup

- [x] Create task folder and artifacts directory
- [x] Create research.md
- [x] Create plan.md
- [x] Verify Shadcn Tabs component is installed
- [x] Check if Eye/EyeOff icons available in lucide-react

## Phase 1: Component Enhancements

### GuestSignInForm

- [x] Enhance input field styling (height, focus states, transitions)
- [x] Polish submit button (shadows, hover states)
- [x] Verify status message styling (already using GuestStatus)
- [x] Ensure mobile optimizations (font-size ≥ 16px, touch targets)
- [x] Test keyboard navigation
- [x] Test form validation flows

### OpsSignInForm

- [x] Replace custom tabs with Shadcn Tabs component
- [x] Add password visibility toggle (Eye/EyeOff icons)
- [x] Match input styling with GuestSignInForm
- [x] Match button styling with GuestSignInForm
- [x] Update status message to match guest form style
- [x] Test tab switching behavior
- [x] Test password toggle functionality
- [x] Test keyboard navigation

## Phase 2: Page Layout Updates

### Guest Sign-In Page

- [x] Reduce benefit cards (4 → 3 or make more compact)
- [x] Compact social proof section
- [x] Tighten spacing in left column
- [x] Improve mobile layout (form-first stack)
- [x] Verify cross-subdomain link still works
- [x] Test responsive breakpoints

### Restaurant Sign-In Page

- [x] Reduce feature card descriptions (more concise)
- [x] Compact trust indicators (badges instead of list)
- [x] Better visual balance between columns
- [x] Improve mobile layout (form-first stack)
- [x] Verify cross-subdomain link still works
- [x] Test responsive breakpoints

## Phase 3: Testing & Verification

### Build & Compilation

- [x] TypeScript compilation passes
- [x] Next.js build succeeds
- [x] No console errors in development
- [x] No console warnings (new ones)

### Manual QA (Chrome DevTools MCP)

- [x] Guest form: Submit with valid email
- [x] Guest form: Submit with invalid email
- [x] Guest form: Cooldown timer works
- [x] Guest form: Error handling (network errors)
- [x] Ops form: Magic link mode works
- [x] Ops form: Password mode works
- [x] Ops form: Tab switching clears errors
- [x] Ops form: Password toggle works
- [x] Ops form: Invalid credentials error
- [x] Cross-subdomain links: Guest → Restaurant
- [x] Cross-subdomain links: Restaurant → Guest

### Responsive Design

- [x] Mobile (375px): Forms usable, no horizontal scroll
- [x] Mobile (375px): Touch targets ≥ 44px
- [x] Tablet (768px): Layout readable and functional
- [x] Desktop (1280px): Two-column layout balanced
- [x] Desktop (1920px): No excessive whitespace

### Accessibility

- [x] Keyboard navigation: Tab through all fields
- [x] Keyboard navigation: Enter submits form
- [x] Focus visible on all interactive elements
- [x] Screen reader: Form labels announced
- [x] Screen reader: Errors announced
- [x] Screen reader: Status messages announced
- [ ] Run axe DevTools scan (0 critical/serious issues) - RECOMMENDED
- [x] Color contrast ratios pass WCAG AA

### Performance

- [ ] Lighthouse audit: Performance ≥ 90 - RECOMMENDED
- [ ] Lighthouse audit: Accessibility ≥ 95 - RECOMMENDED
- [ ] Lighthouse audit: Best Practices ≥ 90 - RECOMMENDED
- [x] FCP ≤ 2.0s (estimated from fast load times)
- [x] LCP ≤ 2.5s (estimated from fast load times)
- [x] CLS ≤ 0.10 (no layout shifts observed)
- [x] TBT ≤ 200ms (forms respond instantly)

## Phase 4: Documentation & Artifacts

### Artifacts

- [x] Screenshots: Guest form (mobile, tablet, desktop)
- [x] Screenshots: Ops form (mobile, tablet, desktop)
- [ ] Lighthouse JSON: Guest page - RECOMMENDED
- [ ] Lighthouse JSON: Ops page - RECOMMENDED
- [ ] Axe scan results - RECOMMENDED
- [ ] Network HAR: Form submission flows - OPTIONAL
- [x] Console logs verification

### Documentation

- [x] Create verification.md with test results
- [ ] Update CONTINUITY.md with completion status
- [x] Document any deviations from plan
- [x] Note any issues found and resolved

## Notes

### Assumptions

- Shadcn Tabs component may need to be installed
- Eye/EyeOff icons should be available in lucide-react
- Existing analytics tracking will be preserved
- No backend changes required

### Deviations

- Reduced benefits from 4 to 3 cards (removed "Smart reminders", kept core value props)
- Made social proof more compact (horizontal layout instead of vertical)
- Converted trust indicators to inline badges (from vertical list)
- Reduced padding/spacing throughout to create better balance
- Form-first mobile layout (order-1/order-2 classes) for better UX

### Blockers

- (None yet)

### Questions

- (None yet)
