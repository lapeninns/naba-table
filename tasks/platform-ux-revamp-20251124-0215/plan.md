---
task: platform-ux-revamp
timestamp_utc: 2025-11-24T02:21:00Z
owner: github:@amanshresthaa
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Platform UX/UI Revamp - Phase 1

## Objective

Create a stunning, mobile-first landing page and polished authentication experience that sets the design foundation for the entire platform, using the design language established in the booking wizard improvements.

## Success Criteria

- [ ] Landing page is visually stunning (WOW factor)
- [ ] Auth flow is seamless and delightful
- [ ] Shared component library established
- [ ] All pages responsive 320px → 1920px+
- [ ] Lighthouse score ≥90 (mobile & desktop)
- [ ] WCAG 2.1 AA compliance
- [ ] Dark mode support
- [ ] Zero breaking changes

## Phase 1 Components

### 1. Shared Component Library

**Location**: `/src/components/shared/`

#### Components to Create:

- **PageHero** - Hero sections with title, description, CTA
- **PageSection** - Generic content sections (adapted from WizardStep)
- **FeatureCard** - Feature highlights
- **StatCard** - Metric displays
- **EmptyState** - No data states
- **GuestNav** - Navigation for logged-in guests

### 2. Landing Page (`/`)

**File**: `/src/app/page.tsx`

#### Sections:

1. **Hero Section**
   - Compelling headline
   - Value proposition
   - Primary CTA: "Find a table"
   - Visual: Gradient background or hero image
2. **How It Works**
   - 3-step process
   - Icons for each step
   - Clear, concise copy

3. **Features/Benefits**
   - 3-4 key features
   - Icons + short description
   - Cards layout

4. **Social Proof** (Optional for v1)
   - Testimonials or stats
   - Trust indicators

5. **Footer**
   - Links (About, Contact, Terms, Privacy)
   - Social media (if applicable)

### 3. Sign-In Page (`/auth/signin`)

**File**: `/src/app/auth/signin/page.tsx`

#### Enhancements:

- Better visual hierarchy
- Consistent with wizard design
- Loading states
- Error states
- Success feedback
- "Remember me" option
- "Forgot password" link
- Social auth (if enabled)

## Architecture & Data Flow

### Component Hierarchy

```
/ (Landing)
├── PageHero
├── HowItWorks
│   └── ProcessStep × 3
├── Features
│   └── FeatureCard × 3-4
└── Footer

/auth/signin
├── PageSection (wrapper)
├── SignInForm (enhanced)
│   ├── Input (email)
│   ├── Input (password)
│   ├── Checkbox (remember)
│   ├── Button (submit)
│   └── ErrorMessage
└── SocialAuth (optional)
```

### Files to Create/Modify

| Component    | Path                                    | Action  |
| ------------ | --------------------------------------- | ------- |
| PageHero     | `src/components/shared/PageHero.tsx`    | Create  |
| PageSection  | `src/components/shared/PageSection.tsx` | Create  |
| FeatureCard  | `src/components/shared/FeatureCard.tsx` | Create  |
| Landing Page | `src/app/page.tsx`                      | Replace |
| SignIn Page  | `src/app/auth/signin/page.tsx`          | Enhance |
| SignInForm   | `src/components/auth/SignInForm.tsx`    | Enhance |

## UI/UX States

### Landing Page States

- **Initial Load**: Fade-in hero, stagger animations for features
- **Scroll**: Sticky nav (if added), scroll animations
- **CTA Click**: Smooth transition to booking flow

### Sign-In States

- **Idle**: Empty form, CTA disabled
- **Filling**: Validation feedback inline
- **Submitting**: Loading spinner, button disabled
- **Success**: Brief success message, redirect
- **Error**: Clear error message, focus on problem field

## Design Specifications

### Landing Page Hero

```
Mobile (320px-639px):
- Padding: px-4 py-12
- Title: text-3xl font-bold
- Description: text-base
- CTA: w-full h-14

Tablet (640px-1023px):
- Padding: px-6 py-16
- Title: text-4xl font-bold
- Description: text-lg
- CTA: w-auto px-8

Desktop (1024px+):
- Padding: px-8 py-24
- Title: text-5xl/text-6xl font-bold
- Description: text-xl
- CTA: w-auto px-10
```

### Color Palette

- Primary: HSL tokens from design system
- Hero background: `gradient-to-br from-primary/5 via-background to-primary/10`
- Cards: `bg-card border-border shadow-md`
- CTA: `bg-primary text-primary-foreground hover:bg-primary/90`

### Typography

- Headings: font-bold, tracking-tight
- Body: font-normal, leading-relaxed
- Scale: text-sm → text-base → text-lg → text-xl → text-2xl → text-3xl

### Spacing

- Sections: space-y-16 (mobile), space-y-24 (desktop)
- Cards: gap-4 (mobile), gap-6 (desktop)
- Internal: gap-2, gap-3, gap-4

## Testing Strategy

### Manual Testing

- [ ] Landing page loads correctly
- [ ] Hero CTA navigates to booking flow
- [ ] All sections render responsively
- [ ] Sign-in form submits correctly
- [ ] Error states display properly
- [ ] Success redirect works
- [ ] Dark mode works on all pages
- [ ] Touch targets ≥44px

### Accessibility Testing

- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] ARIA labels correct
- [ ] Headings hierarchical
- [ ] Alt text on images
- [ ] Color contrast ≥4.5:1

### Performance Testing

- [ ] Lighthouse audit ≥90
- [ ] First Contentful Paint <1.8s
- [ ] Largest Contentful Paint <2.5s
- [ ] No layout shifts (CLS = 0)

## Rollout

### Implementation Steps

1. Create shared components (PageHero, FeatureCard, etc.)
2. Build landing page with all sections
3. Enhance sign-in page
4. Test on device simulator (Chrome DevTools)
5. Verify dark mode
6. Accessibility audit (axe DevTools)
7. Performance audit (Lighthouse)
8. Real device testing (if possible)

### Monitoring

- Track page views for `/` and `/auth/signin`
- Monitor conversion from landing to booking
- Track sign-in success/error rates

## SEO Considerations

### Landing Page Metadata

```typescript
export const metadata: Metadata = {
  title: 'Nab a Table - Reserve Your Perfect Table',
  description:
    'Discover and book tables at the best restaurants. Instant confirmation, easy management, unforgettable dining.',
  openGraph: {
    title: 'Nab a Table - Reserve Your Perfect Table',
    description: 'Book your next dining experience in seconds',
    type: 'website',
  },
};
```

### Sign-In Page Metadata

- Already has good metadata
- May enhance with open graph tags

## Additional Context

### Design Inspiration

- **Hero**: Linear, Vercel (clean, gradient backgrounds)
- **Features**: Stripe, Notion (card-based, icons)
- **Auth**: GitHub, Vercel (minimal, focused)

### Copy Guidelines

- **Tone**: Friendly, confident, helpful
- **Length**: Concise (headlines <10 words, descriptions <25 words)
- **Action**: Use active verbs (Discover, Reserve, Manage)

### Known Limitations

- Landing page content is placeholder (can be refined later)
- Social auth may not be enabled (graceful fallback)
- No images/photos yet (use gradients/illustrations)

## Rollback Plan

If issues arise:

1. Revert `/src/app/page.tsx` to null render
2. Revert `/src/app/auth/signin/page.tsx` to previous version
3. No database changes needed
4. No API changes needed

## Next Steps (Phase 2)

After Phase 1 completion:

- Guest dashboard enhancement
- Bookings list revamp
- Profile page polish
