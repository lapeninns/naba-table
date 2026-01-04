---
task: auth-pages-revamp-20260104-1130
timestamp_utc: 2026-01-04T11:30:00Z
owner: github:@ai-assistant
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Auth Pages Revamp

## Objective

We will enhance the visual design, UX, and responsiveness of both guest and restaurant sign-in pages to improve conversion rates and user satisfaction while maintaining accessibility and performance standards.

## Success Criteria

- [ ] Lighthouse Performance ≥ 90, Accessibility ≥ 95
- [ ] 0 critical/serious accessibility issues (axe DevTools)
- [ ] Keyboard-only navigation works flawlessly
- [ ] Forms work on mobile (375px), tablet (768px), desktop (1280px+)
- [ ] Touch targets ≥ 44px on mobile
- [ ] FCP ≤ 2.0s, LCP ≤ 2.5s, CLS ≤ 0.10
- [ ] Build passes TypeScript and Next.js compilation
- [ ] Cross-subdomain navigation works (already verified)
- [ ] All form validation and error handling preserved

## Architecture & Components

### Components to Enhance

1. **GuestSignInForm** (`components/auth/GuestSignInForm.tsx`)
   - Role: Magic link authentication for guests
   - Changes: Visual polish, spacing, button styling, input refinements
   - Keep: Validation logic, error handling, analytics, accessibility

2. **OpsSignInForm** (`components/auth/OpsSignInForm.tsx`)
   - Role: Magic link + password authentication for restaurant staff
   - Changes: Replace custom tabs with Shadcn Tabs, add password toggle, visual consistency
   - Keep: Dual-mode logic, validation, error handling, analytics

3. **Guest Sign-In Page** (`src/app/(public)/auth/signin/page.tsx`)
   - Role: Page layout with value props and form
   - Changes: Reduce clutter, clearer CTA hierarchy, better mobile layout
   - Keep: Two-column structure, benefits grid, social proof

4. **Restaurant Sign-In Page** (`src/app/app/auth/signin/page.tsx`)
   - Role: Page layout with features and form
   - Changes: Reduce feature card verbosity, better visual balance
   - Keep: Two-column structure, trust indicators, feature cards

### New Components (if needed)

- **PasswordInput** (optional): Reusable password field with show/hide toggle
  - Can be inline in OpsSignInForm or extracted if reused elsewhere

### Component Structure

```
Auth Pages
├── Guest Flow (/auth/signin)
│   ├── EnhancedAuthLayout
│   ├── GuestSignInPage (page.tsx)
│   │   ├── Hero/Value Props Section
│   │   │   ├── Badge
│   │   │   ├── Heading
│   │   │   ├── Benefits Grid
│   │   │   └── Social Proof
│   │   └── GuestSignInForm
│   │       ├── Form Header
│   │       ├── Email Field (with icon)
│   │       ├── Status Message
│   │       ├── Submit Button
│   │       └── Terms Link
│   └── Cross-link to Restaurant
│
└── Restaurant Flow (/app/auth/signin)
    ├── EnhancedAuthLayout
    ├── OpsSignInPage (page.tsx)
    │   ├── Hero/Features Section
    │   │   ├── Badge
    │   │   ├── Heading
    │   │   ├── Feature Cards
    │   │   └── Trust Indicators
    │   └── OpsSignInForm
    │       ├── Form Header
    │       ├── Shadcn Tabs (Magic Link | Password)
    │       ├── Email Field
    │       ├── Password Field (conditional, with toggle)
    │       ├── Status Message
    │       └── Submit Button
    └── Cross-link to Guest
```

## Design Decisions

### Visual Design System

**Color Palette** (consistent across both):

- Primary Action: `bg-blue-600 hover:bg-blue-700`
- Focus Ring: `ring-blue-400`
- Error: `text-red-600 border-red-200 bg-red-50`
- Success: `text-emerald-600 border-emerald-200 bg-emerald-50`
- Neutral: `slate-*` scale for text, borders, backgrounds

**Typography**:

- Form Heading: `text-2xl font-bold tracking-tight`
- Form Subtext: `text-sm text-slate-600`
- Input Labels: `text-sm font-medium text-slate-700`
- Button Text: `text-base font-semibold`

**Spacing**:

- Form container: `space-y-6`
- Input groups: `space-y-5`
- Padding: Consistent `p-6 sm:p-8` for card interiors

**Border Radius**:

- Inputs: `rounded-xl` (12px)
- Buttons: `rounded-xl` (12px)
- Cards: `rounded-2xl` (16px)

### Forms Enhancements

#### GuestSignInForm

1. **Input Field**:
   - Keep mail icon on left
   - Increase height to `h-12` for better touch targets
   - Enhanced focus states with ring and border color transition
   - Placeholder text: "you@example.com"

2. **Submit Button**:
   - Full width with `w-full`
   - Large size `h-12`
   - Blue gradient shadow for depth
   - Loading state with spinner
   - Cooldown timer display

3. **Status Messages**:
   - Use GuestStatus component (already in place)
   - Success: Green with checkmark
   - Error: Red with alert icon
   - Focus management on appearance

4. **Mobile Optimization**:
   - Input font-size ≥ 16px to prevent iOS zoom
   - Touch targets ≥ 44px
   - `touch-manipulation` CSS for better responsiveness

#### OpsSignInForm

1. **Tab Switcher** (Replace custom with Shadcn Tabs):

   ```tsx
   <Tabs defaultValue="password" onValueChange={(v) => setMode(v)}>
     <TabsList className="grid w-full grid-cols-2">
       <TabsTrigger value="magic_link">Magic link</TabsTrigger>
       <TabsTrigger value="password">Password</TabsTrigger>
     </TabsList>
     <TabsContent value="magic_link">{/* Email field only */}</TabsContent>
     <TabsContent value="password">{/* Email + Password fields */}</TabsContent>
   </Tabs>
   ```

2. **Password Field** (with show/hide toggle):

   ```tsx
   <div className="relative">
     <Input type={showPassword ? "text" : "password"} ... />
     <button
       type="button"
       onClick={() => setShowPassword(!showPassword)}
       className="absolute right-3 top-1/2 -translate-y-1/2"
     >
       {showPassword ? <EyeOff /> : <Eye />}
     </button>
   </div>
   ```

3. **Consistent Styling**:
   - Match GuestSignInForm input heights, borders, focus states
   - Same button styling
   - Same status message handling

### Page Layout Enhancements

#### Guest Sign-In Page

**Current Issues**:

- Too many benefit cards (4 cards)
- Social proof takes up space
- Left column feels cluttered

**Improvements**:

1. Reduce benefit cards from 4 to 3 (remove "Smart reminders" or merge)
2. Make social proof more compact (single row)
3. Tighten spacing between elements
4. Mobile: Stack columns, form first

#### Restaurant Sign-In Page

**Current Issues**:

- Feature cards are verbose
- Trust indicators box is large
- Left column dominates

**Improvements**:

1. Reduce feature card descriptions (2-3 words max)
2. Make trust indicators more compact (badges instead of list)
3. Better visual balance between columns
4. Mobile: Stack columns, form first

## Data Flow & API Contracts

### Existing Endpoints (No Changes)

**POST /api/auth/signin**

- Request (Magic Link):
  ```json
  {
    "mode": "magic_link",
    "email": "user@example.com",
    "redirectedFrom": "/guest/dashboard"
  }
  ```
- Request (Password):
  ```json
  {
    "mode": "password",
    "email": "ops@restaurant.com",
    "password": "SecurePass123!",
    "redirectedFrom": "/app"
  }
  ```
- Response (Success):
  ```json
  {
    "status": "magic_link_sent" | "ok",
    "redirectTo": "/guest/dashboard"
  }
  ```
- Errors:
  - 400: Validation error
  - 401: Invalid credentials
  - 403: CSRF token invalid
  - 429: Rate limit exceeded

## UI/UX States

### GuestSignInForm States

1. **Initial**: Empty form, enabled button
2. **Typing**: Real-time email validation (on blur)
3. **Submitting**: Button disabled, spinner visible, "Sending..." text
4. **Success**: Green status message, cooldown timer active, button shows "Resend in Xs"
5. **Error**: Red status message, button re-enabled, focus on status
6. **Cooldown**: Button disabled, countdown display

### OpsSignInForm States

1. **Initial**: Magic link tab selected, email field empty
2. **Tab Switch**: Form clears errors, status resets
3. **Typing**: Real-time validation on blur
4. **Submitting (Magic)**: Button disabled, spinner, "Sending..." text
5. **Submitting (Password)**: Button disabled, spinner, "Signing in..." text
6. **Success (Magic)**: Green status, cooldown timer
7. **Success (Password)**: Green status, "Redirecting..." then navigation
8. **Error**: Red status, field-specific errors if applicable
9. **Cooldown (Magic)**: Button disabled, countdown

### Password Visibility Toggle States

1. **Hidden**: Eye icon, type="password"
2. **Visible**: EyeOff icon, type="text"
3. **Focus**: Ring on button, accessible label

## Edge Cases

### Form Validation

- Empty email → "Enter your email address"
- Invalid email format → "Enter a valid email address"
- Empty password (ops) → "Enter your password"
- Weak password (ops) → "Password must be at least 8 characters..."
- Network error → "Something went wrong. Please try again."
- Rate limit → "Too many attempts. Please try again in a few minutes."
- CSRF error → "Session expired. Refresh and try again."

### Mobile Considerations

- Input font-size ≥ 16px (prevent iOS zoom)
- Touch targets ≥ 44px
- Virtual keyboard doesn't cover submit button
- Form fits in viewport without excessive scrolling
- Tab switcher accessible on small screens

### Accessibility

- Tab key navigates through: email → (password if visible) → submit button → terms links
- Enter key submits form
- Escape key (future): Could clear form or close modal if in one
- Screen reader announces:
  - Form heading and purpose
  - Input labels and errors
  - Status messages (aria-live)
  - Loading states
  - Button state changes

## Testing Strategy

### Unit Tests (Existing - Preserve)

- Form validation schemas
- Error mapping functions
- Password strength validation
- Analytics event tracking

### Integration Tests (Manual via Chrome DevTools MCP)

1. **Form Submission Flows**:
   - Guest magic link: happy path
   - Guest magic link: invalid email
   - Guest magic link: network error
   - Guest magic link: cooldown timer
   - Ops magic link: same scenarios
   - Ops password: happy path
   - Ops password: invalid credentials
   - Ops password: weak password
   - Ops password: toggle visibility

2. **Responsive Design**:
   - Mobile (375px): Form usable, no horizontal scroll
   - Tablet (768px): Layout adapts, readable
   - Desktop (1280px+): Two-column layout balanced

3. **Keyboard Navigation**:
   - Tab through all interactive elements
   - Enter submits form
   - Focus visible on all elements
   - Focus trap in modals (if any)

4. **Accessibility**:
   - Run axe DevTools scan
   - Test with screen reader (VoiceOver/NVDA)
   - Verify ARIA labels and live regions
   - Check color contrast ratios

5. **Performance**:
   - Lighthouse audit (mobile, 4× CPU throttle)
   - Check CLS (no layout shifts on load/interaction)
   - Check LCP (form visible quickly)
   - Check TBT (form interactive quickly)

### Artifacts to Capture

- Screenshots: mobile, tablet, desktop (both forms)
- Lighthouse JSON: performance + accessibility
- Axe scan results
- Network HAR: form submission flows
- Console logs: verify no errors
- TypeScript compilation output
- Production build output

## Rollout

### Deployment Strategy

1. **Phase 1**: Deploy to staging
   - Verify both forms work
   - Test cross-subdomain links
   - Run full QA checklist

2. **Phase 2**: Deploy to production
   - Monitor analytics for form abandonment
   - Watch for error rate spikes
   - Track magic link click-through rate

### Monitoring

- Analytics events (already in place):
  - `auth_guest_signin_viewed`
  - `auth_guest_signin_attempt`
  - `auth_magiclink_sent`
  - `auth_guest_signin_error`
  - `auth_ops_signin_viewed`
  - `auth_ops_signin_attempt`
  - `auth_ops_signin_success`
  - `auth_ops_signin_error`

- Metrics to watch:
  - Form submission rate (attempts / views)
  - Magic link send success rate
  - Password login success rate
  - Error rate by error type
  - Average time to submit

### Rollback Plan

- If critical issues found:
  1. Revert component changes (git revert)
  2. Redeploy previous version
  3. Investigate issues in development
  4. Fix and re-deploy

## Feature Flags

- Not needed for this change (visual enhancement only)
- Consider for future: `feat.auth.social_login`, `feat.auth.remember_me`

## Dependencies

### Shadcn Components (Check if installed)

- ✅ Form (already used)
- ✅ Input (already used)
- ✅ Button (already used)
- ✅ Label (already used)
- ⚠️ Tabs (need to verify if installed, may need to add)

### Icons (lucide-react)

- ✅ Mail (already used)
- ✅ Send (already used)
- ✅ Loader2 (already used)
- ⚠️ Eye (need for password toggle)
- ⚠️ EyeOff (need for password toggle)

### No New Dependencies Required

- All form logic uses existing libraries
- All validation uses existing schemas
- All API calls use existing fetchJson
- All analytics uses existing track/emit

## Timeline Estimate

- Component enhancements: 2-3 hours
- Page layout updates: 1-2 hours
- Manual QA: 1-2 hours
- Documentation: 30 minutes
- **Total**: 4-7 hours (single session)

## Success Metrics (Post-Deploy)

- Conversion rate: Form submissions / page views
- Error rate: Errors / attempts
- Magic link CTR: Clicks / sends
- Password login success: Success / attempts
- Mobile completion rate: Mobile submits / mobile views
- Lighthouse scores maintained or improved
