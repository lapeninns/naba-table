---
task: landing-page-improvements
timestamp_utc: 2026-01-04T10:09:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Landing Page Improvements

## Objective

Transform the landing page from a monolithic 982-line component into a high-converting, accessible, and performant page that increases demo requests by 15%+ while maintaining WCAG AA compliance and excellent Core Web Vitals.

## Success Criteria

- [ ] Lighthouse Performance ≥ 90, Accessibility ≥ 95
- [ ] Page load time < 2.5s (4G, mobile, 4x CPU)
- [ ] Conversion rate (demo requests) increases by ≥ 15%
- [ ] 0 critical/serious accessibility issues (axe DevTools)
- [ ] All interactive elements fully keyboard navigable
- [ ] Bundle size reduced by ≥ 20%

## Architecture & Components

### New Component Structure

```
src/components/landing/
├── index.tsx                 # Public exports
├── LandingPage.tsx           # Main orchestrator
├── sections/
│   ├── HeroSection.tsx        # Split from Hero()
│   ├── ProblemSection.tsx     # Split from ProblemSection()
│   ├── MetricsSection.tsx      # Split from MetricsSection()
│   ├── BenefitsSection.tsx     # Split from BenefitsSection()
│   ├── HowItWorksSection.tsx  # Split from HowItWorks()
│   ├── TestimonialsSection.tsx # Split from Testimonials()
│   ├── FAQSection.tsx         # Split from FAQ()
│   └── CTASection.tsx        # Split from CTA()
├── shared/
│   ├── Icons.tsx              # Extract Icon component
│   ├── LiveFeedCard.tsx       # Extract LiveFeedCard
│   ├── MetricCard.tsx         # Extract MetricCard
│   ├── Navbar.tsx             # Extract Navbar
│   └── Footer.tsx            # Extract Footer
├── optimizations/
│   ├── LazySection.tsx        # Intersection Observer wrapper
│   ├── VideoHero.tsx          # Optimized video component
│   └── StickyCTA.tsx         # Floating CTA button
├── analytics/
│   ├── ClarityProvider.tsx     # Microsoft Clarity integration
│   └── ExitIntentPopup.tsx    # Exit intent modal
└── seo/
    ├── SchemaOrg.tsx           # Structured data
    └── SkipLinks.tsx         # Accessibility skip links
```

### State Management

- **Client State**: React hooks for interactivity (accordion, modals)
- **URL State**: No state in URL (read-only landing page)
- **Server State**: Authentication status (passed as prop)

## Data Flow & API Contracts

### No New API Calls

All data is static/hardcoded. No additional API endpoints needed.

### Existing Data Sources

```typescript
// Local venues (static)
import LOCAL_VENUES from './local-venues.json';

// Auth status (server component)
const {
  data: { user },
} = await supabase.auth.getUser();
```

### New Analytics Integration

```typescript
// Clarity tracking (client-side)
import { Clarity } from '@microsoft/clarity';

Clarity.init('YOUR_PROJECT_ID');

// Track events
Clarity.event('demo_request_clicked');
```

## UI/UX States

### Loading States

- Hero: Progressive enhancement (static → video when loaded)
- Below-fold sections: Skeleton screens before lazy load

### Error States

- Video load failure: Fallback to static hero image
- Analytics failure: Silent fail, no user impact
- Form submission: Inline error messages

### Interactive States

- FAQ: Expandable/collapsible accordions
- Exit intent: Dismissible modal with "Don't show again"
- Sticky CTA: Appears after scroll past hero, disappears at bottom

## Edge Cases

1. **Slow Connection**: Auto-detect network speed, skip video if < 4G
2. **JavaScript Disabled**: Graceful degradation to static HTML
3. **Screen Reader**: Skip links, ARIA labels announced
4. **Touch Devices**: Larger tap targets (44px minimum)
5. **Ad Blockers**: Analytics fail silently, no broken UI
6. **Auth Redirect**: Preserve existing redirect to `/guest/dashboard`

## Testing Strategy

### Unit Tests

- Icon component renders correctly
- LazySection loads content on intersect
- ExitIntentPopup respects localStorage preference
- SchemaOrg generates valid JSON-LD

### Integration Tests

- Landing page renders without errors
- Authenticated users redirected to dashboard
- All links navigate correctly
- Forms submit successfully

### E2E Tests (Playwright)

- Complete user flow from hero to demo request
- Exit intent popup triggers correctly
- Sticky CTA appears/disappears on scroll
- Keyboard navigation through all interactive elements

### Accessibility Tests

- Axe DevTools: 0 critical/serious issues
- Keyboard-only navigation: All CTAs accessible
- Screen reader: Proper announcements
- Color contrast: WCAG AA minimum (4.5:1)

### Performance Tests

- Lighthouse CI: Enforce budgets in PR
- Bundle size: Monitor via CI
- Load time: Measure on real devices

## Rollout

### Feature Flag: `feat.landing.improvements` (default: off)

- **Phase 1**: Internal testing (10% of staff)
- **Phase 2**: External beta (25% of traffic)
- **Phase 3**: Full rollout (100%)

### Monitoring

- **Dashboard**: Vercel Analytics + Clarity
- **Metrics**: Page views, conversion rate, bounce rate, scroll depth
- **Alerts**: Conversion rate drops > 10%, Lighthouse score < 85

### Kill-switch

Revert to previous landing page via feature flag toggle without code deployment.

## DB Change Plan

**No database changes required.** All improvements are frontend-only.

## File Changes

### New Files

```
src/components/landing/sections/*       # 8 section components
src/components/landing/shared/*          # 5 shared components
src/components/landing/optimizations/*   # 3 optimization components
src/components/landing/analytics/*         # 2 analytics components
src/components/landing/seo/*             # 2 SEO components
src/styles/landing.css                   # Extracted global styles
src/app/landing/seo/route.tsx           # Sitemap endpoint (if needed)
```

### Modified Files

```
src/components/landing/FactoryHomeClient.tsx  # Delete (replace with LandingPage.tsx)
src/components/landing/HomeSections.tsx        # Merge into sections/
src/app/(public)/page.tsx                    # Update imports
src/app/layout.tsx                          # Add Clarity provider
next.config.js                              # Add image optimization settings
tailwind.config.js                          # Add landing theme tokens
```

### Deleted Files

```
src/components/landing/FactoryHomeClient.tsx  # After migration complete
```

## Performance Budgets

### Critical Resources

- First Contentful Paint (FCP): ≤ 2.0s
- Largest Contentful Paint (LCP): ≤ 2.5s
- Cumulative Layout Shift (CLS): ≤ 0.10
- Time to Interactive (TTI): ≤ 3.5s
- Total Blocking Time (TBT): ≤ 200ms

### Bundle Size

- Initial JS: ≤ 200KB (gzipped)
- Total JS: ≤ 400KB (gzipped)
- Total CSS: ≤ 50KB (gzipped)

### Assets

- Hero video: ≤ 2MB (MP4, compressed)
- Fallback image: ≤ 200KB (WebP)
- Icons: SVG inline (no external fonts)

## Accessibility Checklist

- [ ] Skip link to main content
- [ ] Only one `<h1>` per page
- [ ] Proper heading hierarchy (h1 → h2 → h3)
- [ ] All images have `alt` text or `aria-hidden`
- [ ] Form inputs have associated labels
- [ ] Focus indicators visible (`:focus-visible`)
- [ ] Color contrast ≥ 4.5:1 (normal text)
- [ ] Interactive elements ≥ 44×44px (touch targets)
- [ ] Reduced motion respected (`prefers-reduced-motion`)
- [ ] ARIA live regions for dynamic content
- [ ] Keyboard trap in modals, focus restored on close

## Security Considerations

- No new secrets or API keys
- Clarity project ID in environment variable
- CSP headers for video domains (if applicable)
- Sanitize all user input (forms)
- HTTPS only for all resources

## Documentation Updates

- Update `AGENTS.md` if new patterns added
- Document new components in `src/components/landing/README.md`
- Add landing page metrics to docs/metrics.md
- Update runbook for monitoring alerts
