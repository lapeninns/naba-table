# Auth Pages Testing & QA Guide

## Pre-Deployment Checklist

### Build & Compilation

- [x] TypeScript compilation passes without errors
- [x] Next.js build succeeds
- [x] No console errors in dev mode
- [x] All imports resolve correctly
- [x] No unused dependencies

### Visual QA

#### Guest Sign-In Page (`/auth/signin`)

- [ ] **Desktop (1920×1080)**
  - [ ] Two-column layout displays correctly
  - [ ] Left column value prop section is readable
  - [ ] Right column form is properly aligned
  - [ ] All 4 benefit cards display with icons
  - [ ] Social proof stats are visible
  - [ ] Footer is complete and links work
  - [ ] Navbar brand and links work
- [ ] **Tablet (768×1024)**
  - [ ] Layout adapts appropriately
  - [ ] Form remains usable
  - [ ] Feature cards stack nicely
- [ ] **Mobile (375×667)**
  - [ ] Single column layout
  - [ ] All content is readable
  - [ ] Buttons are touch-friendly (44px min)
  - [ ] No horizontal scroll

#### Restaurant Sign-In Page (`/app/auth/signin`)

- [ ] **Desktop (1920×1080)**
  - [ ] Two-column layout displays correctly
  - [ ] Professional B2B messaging is clear
  - [ ] 3 feature cards display with descriptions
  - [ ] Security trust box is visible
  - [ ] Tab switcher works smoothly
  - [ ] Footer is complete
- [ ] **Tablet (768×1024)**
  - [ ] Layout adapts appropriately
  - [ ] Form remains usable
- [ ] **Mobile (375×667)**
  - [ ] Single column layout
  - [ ] Tab switcher is usable
  - [ ] All content is readable

### Functional Testing

#### Guest Sign-In Flow

- [ ] **Magic Link Sign-In**
  - [ ] Enter valid email → Success message appears
  - [ ] Enter invalid email → Validation error shows
  - [ ] Cooldown timer works (60s)
  - [ ] "Resend in Xs" displays correctly
  - [ ] Magic link email is received
  - [ ] Clicking magic link signs user in
  - [ ] Redirects to correct page after sign-in
- [ ] **Error Handling**
  - [ ] Rate limit error displays correctly
  - [ ] Network error displays correctly
  - [ ] Invalid email format shows validation
  - [ ] Error messages are accessible (aria-live)
- [ ] **Cross-Navigation**
  - [ ] "Sign in to operations console" link works
  - [ ] Link goes to correct URL (`/app/auth/signin`)

#### Restaurant Sign-In Flow

- [ ] **Tab Switcher**
  - [ ] Clicking "Magic link" tab switches mode
  - [ ] Clicking "Password" tab switches mode
  - [ ] Active tab has correct styling
  - [ ] Inactive tab has correct styling
  - [ ] Keyboard navigation works (Tab, Arrow keys)
- [ ] **Magic Link Sign-In**
  - [ ] Enter valid email → Success message
  - [ ] Cooldown timer works
  - [ ] Magic link email received
  - [ ] Link signs user in correctly
- [ ] **Password Sign-In**
  - [ ] Valid credentials → Success + redirect
  - [ ] Invalid credentials → Error message
  - [ ] Empty password → Validation error
  - [ ] Weak password → Validation error (if applicable)
- [ ] **Cross-Navigation**
  - [ ] "Sign in as a guest" link works
  - [ ] Link goes to correct URL (`/auth/signin`)

### Accessibility Testing

#### Keyboard Navigation

- [ ] **Guest Page**
  - [ ] Tab order is logical
  - [ ] All interactive elements are reachable
  - [ ] Focus indicators are visible
  - [ ] Can submit form with Enter key
  - [ ] Can navigate footer links
- [ ] **Restaurant Page**
  - [ ] Tab switcher keyboard accessible
  - [ ] Arrow keys navigate tabs (optional)
  - [ ] Form submission works with Enter
  - [ ] All links are keyboard accessible

#### Screen Reader Testing (VoiceOver/NVDA)

- [ ] **Page Structure**
  - [ ] Landmarks are announced (header, main, footer)
  - [ ] Headings hierarchy is correct
  - [ ] Page title is descriptive
- [ ] **Forms**
  - [ ] Labels are announced
  - [ ] Error messages are announced
  - [ ] Success messages are announced (aria-live)
  - [ ] Required fields are indicated
  - [ ] Button states are clear (disabled/enabled)
- [ ] **Icons**
  - [ ] Decorative icons have aria-hidden
  - [ ] Meaningful icons have labels

#### Visual Accessibility

- [ ] **Color Contrast**
  - [ ] Text on white background: ≥4.5:1
  - [ ] Button text on blue: ≥4.5:1
  - [ ] Link colors: ≥4.5:1
  - [ ] Error text on red background: ≥4.5:1
- [ ] **Focus Indicators**
  - [ ] Focus rings are visible on all interactive elements
  - [ ] Focus rings have sufficient contrast
  - [ ] Focus order is logical
- [ ] **Text Scaling**
  - [ ] Page is readable at 200% zoom
  - [ ] No content is cut off
  - [ ] Buttons remain clickable

#### WCAG Compliance

- [ ] Run axe DevTools
  - [ ] 0 critical issues
  - [ ] 0 serious issues
  - [ ] Document any moderate/minor issues
- [ ] Run Lighthouse accessibility audit
  - [ ] Score ≥95
  - [ ] Review any flagged issues

### Performance Testing

#### Lighthouse Metrics (Mobile, 4G, 4× CPU)

- [ ] **Guest Sign-In Page**
  - [ ] Performance: ≥90
  - [ ] Accessibility: ≥95
  - [ ] Best Practices: ≥90
  - [ ] SEO: ≥90
  - [ ] FCP: ≤2.0s
  - [ ] LCP: ≤2.5s
  - [ ] CLS: ≤0.1
  - [ ] TBT: ≤200ms
- [ ] **Restaurant Sign-In Page**
  - [ ] Performance: ≥90
  - [ ] Accessibility: ≥95
  - [ ] Best Practices: ≥90
  - [ ] SEO: ≥90
  - [ ] Core Web Vitals: Pass

#### Network Performance

- [ ] **Slow 3G**
  - [ ] Page is usable within 5s
  - [ ] Critical content loads first
  - [ ] No layout shifts
- [ ] **Offline**
  - [ ] Graceful error handling
  - [ ] Clear offline message

### Browser Compatibility

#### Desktop Browsers

- [ ] **Chrome (latest)**
  - [ ] Layout correct
  - [ ] All features work
  - [ ] No console errors
- [ ] **Firefox (latest)**
  - [ ] Layout correct
  - [ ] All features work
  - [ ] No console errors
- [ ] **Safari (latest)**
  - [ ] Layout correct
  - [ ] All features work
  - [ ] No console errors
  - [ ] Backdrop blur works
- [ ] **Edge (latest)**
  - [ ] Layout correct
  - [ ] All features work

#### Mobile Browsers

- [ ] **iOS Safari**
  - [ ] Layout correct
  - [ ] Touch targets ≥44px
  - [ ] No zoom on focus
  - [ ] Safe area insets respected
- [ ] **Chrome Android**
  - [ ] Layout correct
  - [ ] Touch targets adequate
  - [ ] Virtual keyboard doesn't break layout
- [ ] **Samsung Internet**
  - [ ] Layout correct
  - [ ] All features work

### Security Testing

- [ ] **CSRF Protection**
  - [ ] CSRF token is present
  - [ ] Form submission includes token
  - [ ] Invalid token is rejected
- [ ] **Rate Limiting**
  - [ ] Too many requests → 429 error
  - [ ] Error message is user-friendly
  - [ ] Cooldown period is enforced
- [ ] **Input Validation**
  - [ ] XSS attempts are sanitized
  - [ ] SQL injection attempts fail
  - [ ] Email validation works
  - [ ] Password validation works (restaurant)
- [ ] **Redirect Safety**
  - [ ] Open redirect is prevented
  - [ ] Only allowed paths work
  - [ ] Malicious URLs are rejected

### SEO & Meta

- [ ] **Guest Page**
  - [ ] Title tag is present and descriptive
  - [ ] Meta description is present
  - [ ] Canonical URL is correct
  - [ ] No duplicate content issues
- [ ] **Restaurant Page**
  - [ ] Title tag is present and descriptive
  - [ ] Meta description is present
  - [ ] Robots meta is appropriate
  - [ ] Schema markup (if applicable)

### Edge Cases

- [ ] **Error States**
  - [ ] Network failure → User-friendly message
  - [ ] Server error → Graceful degradation
  - [ ] Invalid token → Clear error
  - [ ] Expired session → Redirect to sign-in
- [ ] **URL Parameters**
  - [ ] `?redirectedFrom=` works correctly
  - [ ] `?error=` displays error message
  - [ ] `?message=` displays custom message
  - [ ] Malicious parameters are sanitized
- [ ] **Already Signed In**
  - [ ] Redirects to dashboard
  - [ ] No flash of sign-in form
  - [ ] Correct redirect path
- [ ] **Multiple Tabs**
  - [ ] Sign in one tab → Other tab updates
  - [ ] No race conditions
  - [ ] Session sync works

### Analytics & Tracking

- [ ] **Events Fire Correctly**
  - [ ] Page view events
  - [ ] Form submission events
  - [ ] Success events
  - [ ] Error events
  - [ ] Cross-link click events
- [ ] **Data Accuracy**
  - [ ] User properties are set
  - [ ] Event properties are correct
  - [ ] No PII is logged
  - [ ] Timestamps are accurate

## Testing Tools

### Required

- **Chrome DevTools** - Performance, Network, Accessibility
- **Lighthouse** - Performance and accessibility audits
- **axe DevTools** - WCAG compliance scanning
- **VoiceOver (macOS)** or **NVDA (Windows)** - Screen reader testing

### Optional

- **BrowserStack** - Cross-browser testing
- **WebPageTest** - Performance testing
- **Pa11y** - Automated accessibility testing
- **Cypress/Playwright** - E2E testing

## Bug Reporting Template

```markdown
### Bug Description

[Clear description of the issue]

### Steps to Reproduce

1. Go to [page]
2. Click on [element]
3. Observe [behavior]

### Expected Behavior

[What should happen]

### Actual Behavior

[What actually happens]

### Environment

- **Browser**: [Chrome 120, Firefox 121, etc.]
- **OS**: [macOS 14, Windows 11, etc.]
- **Device**: [Desktop, iPhone 15, etc.]
- **Screen Size**: [1920×1080, 375×667, etc.]

### Screenshots/Videos

[Attach visual evidence]

### Console Errors

[Paste any console errors]

### Severity

- [ ] Critical - Blocks functionality
- [ ] High - Major usability issue
- [ ] Medium - Moderate issue
- [ ] Low - Minor cosmetic issue
```

## Sign-Off

### Development

- [ ] All code reviewed
- [ ] TypeScript strict mode passes
- [ ] ESLint passes with no warnings
- [ ] Prettier formatting applied
- [ ] No commented-out code
- [ ] No debug statements

### Design

- [ ] Matches design specs
- [ ] Brand guidelines followed
- [ ] Responsive on all breakpoints
- [ ] Animations are smooth
- [ ] Visual polish complete

### QA

- [ ] All test cases pass
- [ ] No critical/high bugs
- [ ] Performance benchmarks met
- [ ] Accessibility standards met
- [ ] Cross-browser tested

### Product

- [ ] User flows work as expected
- [ ] Copy is approved
- [ ] CTAs are effective
- [ ] Analytics tracking verified
- [ ] Ready for release

---

## Post-Deployment Monitoring

### Week 1

- [ ] Monitor error rates
- [ ] Check conversion rates
- [ ] Review user feedback
- [ ] Check performance metrics
- [ ] Monitor server logs

### Week 2-4

- [ ] A/B test results (if applicable)
- [ ] User satisfaction surveys
- [ ] Heatmap analysis
- [ ] Session recordings review
- [ ] Iterate based on data

---

**Last Updated**: January 4, 2026  
**Prepared By**: Development Team  
**Status**: Ready for QA
