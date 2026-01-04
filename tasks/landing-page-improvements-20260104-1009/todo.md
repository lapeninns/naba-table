---
task: landing-page-improvements
timestamp_utc: 2026-01-04T10:09:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Create task folder and artifacts directory
- [ ] Review AGENTS policies for landing components
- [ ] Set up feature flag `feat.landing.improvements` (default: false)
- [ ] Install dependencies: `@microsoft/clarity`, `react-intersection-observer`
- [ ] Configure Clarity project ID in `.env.local`

## Phase 1: Foundation (Code Refactoring)

### Component Structure

- [ ] Create `src/components/landing/sections/` directory
- [ ] Extract `HeroSection.tsx` from `FactoryHomeClient.Hero()`
- [ ] Extract `ProblemSection.tsx` from `FactoryHomeClient.ProblemSection()`
- [ ] Extract `MetricsSection.tsx` from `FactoryHomeClient.MetricsSection()`
- [ ] Extract `BenefitsSection.tsx` from `FactoryHomeClient.BenefitsSection()`
- [ ] Extract `HowItWorksSection.tsx` from `FactoryHomeClient.HowItWorks()`
- [ ] Extract `TestimonialsSection.tsx` from `FactoryHomeClient.Testimonials()`
- [ ] Extract `FAQSection.tsx` from `FactoryHomeClient.FAQ()`
- [ ] Extract `CTASection.tsx` from `FactoryHomeClient.CTA()`

### Shared Components

- [ ] Extract `Navbar.tsx` component
- [ ] Extract `Footer.tsx` component
- [ ] Extract `Icons.tsx` (centralized icon system)
- [ ] Extract `LiveFeedCard.tsx` component
- [ ] Extract `MetricCard.tsx` component
- [ ] Create `src/components/landing/shared/index.ts` exports

### Styles & Theme

- [ ] Create `src/styles/landing.css` for global styles
- [ ] Move `FACTORY_THEME` to Tailwind config (`tailwind.config.js`)
- [ ] Add landing-specific theme tokens to CSS variables
- [ ] Remove inline `<style>` from `GlobalStyles()`
- [ ] Update all components to use Tailwind classes

### Main Orchestrator

- [ ] Create `src/components/landing/LandingPage.tsx`
- [ ] Import all extracted sections
- [ ] Add `AnimationObserver` wrapper
- [ ] Test component renders without errors

## Phase 2: Performance Optimization

### Image & Video

- [ ] Create `optimizations/VideoHero.tsx` component
- [ ] Compress hero video to ≤ 2MB (HandBrake/ffmpeg)
- [ ] Create fallback static image (WebP, ≤ 200KB)
- [ ] Implement network detection for progressive enhancement
- [ ] Replace static SVG with optimized image/video

### Lazy Loading

- [ ] Create `optimizations/LazySection.tsx` wrapper
- [ ] Wrap `ProblemSection`, `BenefitsSection`, `HowItWorks`, `Testimonials` in `LazySection`
- [ ] Implement Intersection Observer with threshold
- [ ] Add skeleton screen placeholders
- [ ] Test scroll-based loading works

### Code Splitting

- [ ] Lazy load analytics components with `React.lazy()`
- [ ] Lazy load ExitIntentPopup
- [ ] Use dynamic imports for heavy libraries
- [ ] Verify bundle size reduction

### Core Web Vitals

- [ ] Run Lighthouse audit (baseline)
- [ ] Set up Lighthouse CI in `.github/workflows/`
- [ ] Configure performance budgets in `lighthouserc.js`
- [ ] Optimize critical CSS (inline above-fold styles)
- [ ] Defer non-critical JavaScript

## Phase 3: SEO & Accessibility

### Schema Markup

- [ ] Create `seo/SchemaOrg.tsx` component
- [ ] Add `Organization` schema
- [ ] Add `Product` schema (booking system)
- [ ] Add `FAQPage` schema (if using FAQ data)
- [ ] Add `WebSite` schema with search action
- [ ] Test with Google Rich Results Test

### Meta Tags

- [ ] Add `twitter:card` and `twitter:site` metadata
- [ ] Update `openGraph` images with optimized assets
- [ ] Add `canonical` URL
- [ ] Add `robots` meta tag
- [ ] Verify metadata renders correctly

### Accessibility Improvements

- [ ] Create `seo/SkipLinks.tsx` component
- [ ] Add skip link to main content
- [ ] Add skip link to navigation
- [ ] Verify single `<h1>` per page
- [ ] Audit heading hierarchy (h1 → h2 → h3)
- [ ] Add `aria-label` to icon-only buttons
- [ ] Ensure all forms have associated labels
- [ ] Test keyboard navigation (Tab, Enter, Escape)
- [ ] Verify color contrast meets WCAG AA
- [ ] Add `prefers-reduced-motion` media queries

## Phase 4: Conversion Optimization

### Sticky CTA

- [ ] Create `optimizations/StickyCTA.tsx` component
- [ ] Implement scroll detection logic
- [ ] Show after hero section, hide at footer
- [ ] Add smooth scroll to top on click
- [ ] Mobile-responsive (bottom sheet on mobile)
- [ ] A/B test different copy variants

### Exit Intent Popup

- [ ] Create `analytics/ExitIntentPopup.tsx` component
- [ ] Implement mouse movement detection (top 50px)
- [ ] Add timer-based trigger (30s)
- [ ] Respect "Don't show again" preference (localStorage)
- [ ] Design modal with clear CTA and close button
- [ ] Test on desktop and mobile

### Social Proof

- [ ] Add partner logo section (real logos, not text)
- [ ] Highlight number of venues
- [ ] Add live booking counter ("12 tables booked today")
- [ ] Create "Featured In" section (press mentions)
- [ ] Add video testimonial from real customer

### Trust Elements

- [ ] Add "Only X spots left this month" badge (dynamic)
- [ ] Add security badges (SSL, GDPR)
- [ ] Display current month availability
- [ ] Add "No credit card required" reassurance
- [ ] Show setup time guarantee ("Ready in 24h")

## Phase 5: Analytics & Monitoring

### Microsoft Clarity

- [ ] Create `analytics/ClarityProvider.tsx` component
- [ ] Add to root layout (`src/app/layout.tsx`)
- [ ] Track custom events:
  - [ ] `demo_request_clicked`
  - [ ] `hero_cta_clicked`
  - [ ] `video_played`
  - [ ] `section_viewed`
  - [ ] `exit_intent_triggered`
  - [ ] `sticky_cta_clicked`
- [ ] Set up heatmaps and recordings
- [ ] Verify GDPR compliance (consent banner if needed)

### Vercel Analytics

- [ ] Enable Vercel Analytics in project settings
- [ ] Add `@vercel/analytics` package
- [ ] Install `Analytics` component in layout
- [ ] Set up conversion funnel tracking

### Performance Monitoring

- [ ] Configure Lighthouse CI in GitHub Actions
- [ ] Set up performance budgets
- [ ] Add bundle size monitoring
- [ ] Create performance dashboard (Data Studio or similar)

## Phase 6: Testing

### Unit Tests

- [ ] Test `Icons.tsx` renders correct SVG paths
- [ ] Test `LazySection` triggers on intersect
- [ ] Test `ExitIntentPopup` respects localStorage
- [ ] Test `SchemaOrg` generates valid JSON-LD
- [ ] Test `VideoHero` falls back to image

### Integration Tests

- [ ] Test landing page renders without errors
- [ ] Test authenticated user redirect to `/guest/dashboard`
- [ ] Test all navigation links work
- [ ] Test demo request form submission
- [ ] Test feature flag toggle

### E2E Tests (Playwright)

- [ ] Test complete user flow (hero → demo request)
- [ ] Test exit intent popup triggers
- [ ] Test sticky CTA appears/disappears on scroll
- [ ] Test keyboard navigation through all elements
- [ ] Test mobile responsiveness (375px, 768px)

### Accessibility Tests

- [ ] Run axe DevTools audit
- [ ] Fix all critical/serious issues
- [ ] Test with screen reader (NVDA/VoiceOver)
- [ ] Verify color contrast ratios
- [ ] Test zoom 200% (WCAG AA)
- [ ] Test with reduced motion preference

### Performance Tests

- [ ] Run Lighthouse audit (mobile 4G, 4x CPU)
- [ ] Verify LCP ≤ 2.5s, FCP ≤ 2.0s, CLS ≤ 0.10
- [ ] Measure bundle size reduction
- [ ] Test on real devices (iPhone, Android)

## Phase 7: Deployment

### Pre-deployment

- [ ] Run all tests: `pnpm run test`
- [ ] Run linter: `pnpm run lint`
- [ ] Run typecheck: `pnpm run typecheck`
- [ ] Run E2E tests: `pnpm run test:e2e`
- [ ] Verify Lighthouse scores ≥ 90
- [ ] Check accessibility: 0 critical issues
- [ ] Review all changes in PR

### Rollout

- [ ] Merge to main branch
- [ ] Enable feature flag for 10% of traffic
- [ ] Monitor conversion rate for 2 hours
- [ ] Roll out to 50% if metrics stable
- [ ] Roll out to 100% after 24 hours
- [ ] Monitor for 7 days

### Post-deployment

- [ ] Set up conversion rate alerts
- [ ] Review Clarity heatmaps
- [ ] Analyze scroll depth
- [ ] A/B test hero CTA copy
- [ ] Document any issues in `tasks/landing-page-improvements-20260104-1009/verification.md`

## Phase 8: Cleanup

### Code Cleanup

- [ ] Delete `FactoryHomeClient.tsx` after migration complete
- [ ] Remove unused imports
- [ ] Consolidate duplicate code
- [ ] Update documentation
- [ ] Add inline comments where needed

### Documentation Updates

- [ ] Update `AGENTS.md` with new patterns
- [ ] Create `src/components/landing/README.md`
- [ ] Add landing metrics to docs
- [ ] Update runbook for monitoring

### GitHub Cleanup

- [ ] Close related issues
- [ ] Link PR to task folder
- [ ] Attach screenshots and Lighthouse reports
- [ ] Archive task folder after 30 days

## Notes

- Assumptions:
  - Clarity project ID provided via environment variable
  - Video assets already created/optimized
  - Partner logos available as SVGs
  - No database changes required

- Deviations:
  - Initially planned to keep both landing components, but merging to `HomeSections` pattern
  - Exit intent popup limited to desktop only (no mobile trigger)

## Batched Questions

- Should we use Framer Motion or native CSS animations?
- Which A/B testing platform? Vercel Speed Insights or Optimizely?
- Should we add a chat widget (Intercom, Drift, etc.)?
- What conversion rate target to set in monitoring alerts?
