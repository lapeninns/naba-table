---
task: landing-page-improvements
timestamp_utc: 2026-01-04T10:09:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Landing Page Improvements

## Requirements

### Functional

- Split `FactoryHomeClient` into smaller, maintainable components
- Add conversion optimization features (sticky CTA, exit intent)
- Implement SEO enhancements (schema markup, meta tags)
- Add performance optimizations (lazy loading, code splitting)
- Improve accessibility (skip links, ARIA labels, keyboard navigation)
- Add social proof and trust indicators

### Non-functional

- **Accessibility**: WCAG 2.1 AA compliance, keyboard navigation, screen reader support
- **Performance**: LCP ≤ 2.5s, FCP ≤ 2.0s, CLS ≤ 0.10 (mobile, 4G)
- **Security**: No new data sources, no PII exposure
- **Maintainability**: Follow existing patterns, DRY/KISS/YAGNI principles
- **Internationalization**: Prepare copy for localization where applicable

## Existing Patterns & Reuse

### Components Available

- `src/components/landing/FactoryHomeClient.tsx` - Current landing page (982 lines)
- `src/components/landing/HomeSections.tsx` - Alternative section components (more modern)
- `src/components/ui/button.tsx` - Shadcn Button primitive
- `src/components/ui/badge.tsx` - Shadcn Badge primitive
- `src/components/ui/card.tsx` - Shadcn Card primitive
- `src/components/layouts/MarketingLayout.tsx` - Marketing layout wrapper

### Design System

- Guest theme tokens: `--guest-radius-xl`, `--guest-radius-2xl`, etc.
- Blue accent colors: `bg-blue-50`, `text-blue-700`
- Semantic borders: `border-sem`
- Shadow system: `shadow-card`

### Integrations

- Next.js 14 (App Router)
- Supabase for auth (server component)
- Tailwind CSS for styling
- Lucide React for icons

## Constraints & Risks

### Constraints

- Must preserve existing routing (`/` → redirects authenticated users to `/guest/dashboard`)
- Cannot break existing authentication flow
- Must maintain current metadata for SEO
- Mobile-first responsive design required
- Limited to 2-day implementation window

### Risks

- **Breaking Change**: Splitting `FactoryHomeClient` could affect hot-reload in dev
- **Performance Risk**: Adding new features (video, analytics) could slow down page load
- **Accessibility Gap**: New interactive elements must meet WCAG standards
- **SEO Impact**: Structural changes could affect search rankings
- **User Experience**: Too many CTAs/overlays could be annoying

**Mitigation**:

- Incremental implementation with feature flags
- Performance budgets enforced via Lighthouse CI
- A11y testing with axe DevTools
- Gradual rollout (10% → 50% → 100%)
- A/B test conversion rate changes

## External Resources

- [Next.js Schema.org](https://nextjs.org/docs/app/building-your-application/optimizing/metadata#schemaorg) - For structured data
- [Lighthouse Performance Budgets](https://github.com/GoogleChrome/lighthouse-ci) - For CI enforcement
- [React Intersection Observer](https://github.com/thebuilder/react-intersection-observer) - For lazy loading
- [Clarity Analytics](https://clarity.microsoft.com/) - For heatmaps/recordings
- [Video compression best practices](https://web.dev/compress-images/) - For hero video

## Open Questions

- Q: Should we keep both `FactoryHomeClient` and `HomeSections.tsx`, or merge them?
  A: Merge - `HomeSections.tsx` has better structure, migrate remaining content

- Q: Which analytics platform to use? Hotjar, Clarity, or Pendo?
  A: Use Microsoft Clarity (free, privacy-focused, GDPR compliant)

- Q: Exit intent popup timing and triggers?
  A: Show after 30s on page OR when mouse moves toward top of viewport, max once per session

- Q: How to handle video playback if user has slow connection?
  A: Progressive enhancement - load video only if `navigator.connection.effectiveType` is '4g' or better, otherwise show static fallback

## Recommended Direction

1. **Phase 1: Foundation** (Day 1, Morning)
   - Split `FactoryHomeClient` into smaller components
   - Extract global styles to CSS file
   - Move theme to Tailwind config

2. **Phase 2: Performance** (Day 1, Afternoon)
   - Add next/image optimization
   - Implement lazy loading for below-fold sections
   - Add schema markup for SEO

3. **Phase 3: Conversion** (Day 2, Morning)
   - Add sticky CTA
   - Implement exit intent popup
   - Add social proof logos and testimonials

4. **Phase 4: Analytics & Testing** (Day 2, Afternoon)
   - Add Clarity analytics
   - Set up Lighthouse CI
   - A/B test hero CTA copy
   - Manual QA with Chrome DevTools MCP

**Success Criteria**:

- [ ] Lighthouse performance score ≥ 90
- [ ] Accessibility audit: 0 critical/serious issues
- [ ] Page load time < 2.5s (4G, mobile)
- [ ] Conversion rate increase ≥ 15%
- [ ] All interactive elements keyboard accessible
