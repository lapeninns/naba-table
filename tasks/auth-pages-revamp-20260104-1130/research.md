---
task: auth-pages-revamp-20260104-1130
timestamp_utc: 2026-01-04T11:30:00Z
owner: github:@ai-assistant
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Research: Auth Pages Revamp

## Requirements

### Functional

- Guest sign-in page (`/auth/signin`) with magic link authentication
- Restaurant sign-in page (`/app/auth/signin`) with magic link + password authentication
- Cross-subdomain navigation links (already fixed)
- Email validation and error handling
- Loading states during submission
- Success/error feedback to users

### Non-functional

- **Accessibility**: WCAG AA compliance, keyboard-only navigation, screen reader support
- **Performance**: FCP ≤ 2.0s, LCP ≤ 2.5s, CLS ≤ 0.10
- **Responsive**: Mobile-first (375px → 1920px)
- **Security**: Client + server validation, rate limiting, CSRF protection
- **UX**: Clear CTAs, focused design, reduced clutter

## Existing Patterns & Reuse

### Current Components

**GuestSignInForm** (`components/auth/GuestSignInForm.tsx`):

- ✅ Uses Shadcn UI primitives (Form, Input, Button)
- ✅ React Hook Form with Zod validation
- ✅ Magic link only authentication
- ✅ Email validation with immediate feedback
- ✅ Loading states and cooldown timer (60s)
- ✅ Accessible status messages with aria-live
- ✅ Focus management on errors
- ✅ Analytics tracking (track/emit)
- ⚠️ Design: Good foundation but can be enhanced
- ⚠️ Visual hierarchy could be clearer

**OpsSignInForm** (`components/auth/OpsSignInForm.tsx`):

- ✅ Uses Shadcn UI primitives (Form, Input, Button)
- ✅ React Hook Form with Zod validation
- ✅ Dual mode: Magic link + Password
- ✅ Custom tab switcher (role="tablist")
- ✅ Password strength validation
- ✅ Loading states and cooldown timer
- ✅ Accessible status messages
- ✅ Focus management
- ✅ Router integration for redirects
- ⚠️ Tab design could be more polished
- ⚠️ Visual consistency with guest form

### Page Layouts

**Guest Sign-In Page** (`src/app/(public)/auth/signin/page.tsx`):

- ✅ Two-column layout (value props | form)
- ✅ Benefits grid with icons
- ✅ Social proof metrics
- ✅ Cross-link to restaurant sign-in (absolute URL)
- ✅ Error handling from URL params
- ✅ Server-side auth check and redirect
- ✅ EnhancedAuthLayout wrapper
- ⚠️ Could reduce clutter in left column
- ⚠️ CTA hierarchy could be clearer

**Restaurant Sign-In Page** (`src/app/app/auth/signin/page.tsx`):

- ✅ Two-column layout (features | form)
- ✅ Feature cards with icons
- ✅ Trust indicators (SOC 2, SLA, encryption)
- ✅ Cross-link to guest sign-in (absolute URL)
- ✅ Error handling from URL params
- ✅ Server-side auth check and redirect
- ✅ EnhancedAuthLayout wrapper
- ⚠️ Feature cards take up a lot of space
- ⚠️ Visual balance between columns

### Shared Dependencies

- `@hookform/resolvers/zod` - Form validation
- `react-hook-form` - Form state management
- `zod` - Schema validation
- `lucide-react` - Icons
- Shadcn UI components: Form, Input, Button, Label
- `/api/auth/signin` - Unified auth endpoint
- `@/lib/analytics` - Event tracking
- `@/lib/http/fetchJson` - HTTP client
- `@/lib/security/passwordPolicy` - Password validation (ops only)

## External Resources

- [WAI-ARIA APG: Sign-In Form Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/form/) - ARIA best practices
- [Web.dev: Sign-in Form Best Practices](https://web.dev/sign-in-form-best-practices/) - UX patterns
- [WCAG 2.1 Level AA](https://www.w3.org/WAI/WCAG21/quickref/) - Accessibility requirements

## Constraints & Risks

### Constraints

- Must maintain backward compatibility with `/api/auth/signin` endpoint
- Must preserve analytics tracking events
- Must keep cross-subdomain navigation working (absolute URLs)
- Must maintain magic link cooldown behavior (60s)
- Must validate passwords using existing `passwordPolicy.ts`
- Cannot change authentication flow or backend logic

### Risks

- **Medium**: Visual changes might affect conversion rate (need A/B testing eventually)
- **Low**: Form validation changes could break existing flows (mitigated by comprehensive testing)
- **Low**: Layout changes could cause CLS issues (mitigated by reserved space for elements)
- **Low**: Mobile responsiveness edge cases (mitigated by mobile-first approach)

## Recommended Direction (with rationale)

### Approach: Iterative Enhancement

**Phase 1: Forms Polish** (This task)

1. Enhance GuestSignInForm visual design
   - Cleaner input styling
   - Better spacing and hierarchy
   - Enhanced focus states
   - Polished button design

2. Enhance OpsSignInForm visual design
   - Use Shadcn Tabs component instead of custom tabs
   - Consistent styling with guest form
   - Better visual separation between modes
   - Enhanced password field (show/hide toggle)

3. Update page layouts
   - Reduce clutter in value prop columns
   - Clearer CTA hierarchy
   - Better mobile responsive behavior
   - Ensure consistent spacing

**Rationale**:

- Both forms already have solid foundations (validation, accessibility, error handling)
- Focus on visual polish and UX refinement rather than rebuild
- Incremental changes reduce risk of breaking existing functionality
- Shadcn Tabs provides better accessibility and consistency

### What to Keep (Working Well)

- ✅ Form validation logic and error handling
- ✅ Analytics tracking
- ✅ Loading states and cooldown timers
- ✅ Accessibility features (aria-live, focus management)
- ✅ Cross-subdomain navigation (just fixed)
- ✅ Server-side auth checks
- ✅ Error message mapping

### What to Enhance

- 🎨 Visual design and hierarchy
- 🎨 Spacing and layout consistency
- 🎨 Button and input styling
- 🎨 Tab component (ops form)
- 🎨 Mobile responsive behavior
- 🎨 Focus states and transitions
- 📱 Touch target sizes (≥44px on mobile)

### What to Add

- 👁️ Password visibility toggle (ops form)
- 🎯 Better visual feedback on interaction
- 📊 Subtle micro-interactions (hover/focus states)
- 🎨 Consistent color palette across both forms

## Open Questions

### Design

- Q: Should we add a "Remember me" checkbox for password login?
  - A: Out of scope for now; can add in future iteration

- Q: Should we add social auth (Google, GitHub)?
  - A: Out of scope; requires backend changes

- Q: Should we show password strength indicator?
  - A: Nice to have but not critical; defer to future

### Technical

- Q: Should we use Shadcn Tabs component for ops form?
  - A: **Yes** - Better accessibility and consistency with design system

- Q: Should we add show/hide password toggle?
  - A: **Yes** - Industry standard UX pattern

- Q: Should we change the magic link cooldown duration?
  - A: No - 60 seconds is reasonable for rate limiting

## Success Criteria

- [ ] Both forms render correctly on mobile (375px), tablet (768px), desktop (1280px+)
- [ ] Keyboard-only navigation works for all interactive elements
- [ ] Screen reader announces form errors and status messages correctly
- [ ] Forms validate on submit with immediate error feedback
- [ ] Loading states show during async operations
- [ ] Cross-subdomain navigation links work
- [ ] Lighthouse Accessibility score ≥ 95
- [ ] Lighthouse Performance score ≥ 90
- [ ] 0 critical/serious accessibility issues (axe)
- [ ] Build passes TypeScript and Next.js compilation
- [ ] No console errors in development or production

## Testing Strategy

### Manual QA (Chrome DevTools MCP)

1. Test both forms on multiple viewport sizes
2. Test keyboard navigation (Tab, Enter, Escape)
3. Test form validation (empty, invalid email, weak password)
4. Test loading states and cooldown timers
5. Test error handling (network errors, validation errors)
6. Test cross-subdomain links
7. Test focus management

### Automated Testing

1. Run Lighthouse audit (performance, accessibility)
2. Run axe accessibility scan
3. Verify TypeScript compilation
4. Verify production build

### Artifacts to Capture

- Screenshots: Mobile, tablet, desktop for both forms
- Lighthouse JSON reports
- Accessibility scan results
- Network HAR files (form submission flows)
- Console logs (ensure no errors)
