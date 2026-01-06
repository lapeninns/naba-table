---
task: guest-ui-revamp
timestamp_utc: 2026-01-05T00:03:00Z
owner: github:@ai-agent
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Guest UI/UX Revamp

## Requirements

### Functional

- Maintain all existing guest functionality (dashboard, profile, bookings management, receipts)
- Preserve current data flow and API contracts
- Keep existing navigation structure
- Support mobile-first responsive layouts (375px → 768px → 1280px+)

### Non-functional (a11y, perf, security, privacy, i18n)

**Accessibility (WCAG AA)**

- Full keyboard navigation with visible focus indicators
- Semantic HTML with proper ARIA labels
- Color contrast ratios ≥ 4.5:1 for text
- Screen reader friendly navigation
- Touch targets ≥ 44px on mobile

**Performance**

- FCP ≤ 2.0s (mobile, 4× CPU, 4G)
- LCP ≤ 2.5s
- CLS ≤ 0.10
- TBT ≤ 200ms
- Critical interaction latency P95 ≤ 500ms

**Design Quality**

- Avoid "AI slop" patterns (purple-blue gradients, Inter/Roboto, generic cards)
- Create distinctive, memorable brand experience
- Warm, approachable aesthetic (hospitality industry)
- Subtle depth with layered shadows
- Intentional micro-interactions

**Security & Privacy**

- No client-side exposure of sensitive data
- Maintain existing auth patterns

**i18n**

- English only (current scope)

## Existing Patterns & Reuse

### Current Design System

**Colors (Guest Theme)**

```css
--primary: 217 91% 60%; /* blue-500 */
--primary-foreground: 210 40% 98%;
--secondary: 213 96% 93%; /* blue-100 */
--accent: 213 100% 96%; /* blue-50 */
```

**Typography**

- Font: 'Nab a Table Cereal App' (custom), fallback to system-ui
- Heading classes: `.heading-xl`, `.heading-lg`, `.heading-md`
- Body classes: `.text-body`, `.text-sm`, `.text-xs`
- Weight: 300-800 range

**Spacing**

- Tailwind default scale (4px base)
- Custom tokens: `--space-*` not found (uses Tailwind defaults)

**Components (Shadcn)**

- Already using: Button, Badge, Skeleton, Card (implicitly)
- Available but underutilized: Avatar, Separator, Tabs, Dialog, Toast

### Reusable Patterns in Codebase

1. **Card-based layouts** - Used extensively in dashboard
   - Pattern: `rounded-2xl border border-slate-200 bg-white p-5 shadow-card`
   - Reusable: Yes, standardize as Shadcn Card variant

2. **Status badges** - Booking status, "Happening today", etc.
   - Pattern: `rounded-full px-3 py-1 font-semibold`
   - Reusable: Yes, via Shadcn Badge with custom variants

3. **Stat pills** - Dashboard metrics (Upcoming, Favorites)
   - Pattern: Custom component in dashboard
   - Reusable: Extract to shared component

4. **Featured booking card** - Large hero-style booking display
   - Pattern: Grid layout with QR code section
   - Reusable: Could be variant of booking card component

5. **Loading states** - Skeleton screens
   - Pattern: Shadcn Skeleton
   - Reusable: Yes, already consistent

### Anti-patterns to Avoid (from current implementation)

1. **Inline gradient on hero section**

   ```tsx
   className = 'bg-gradient-to-r from-blue-50 to-white';
   ```

   Issue: Generic, lacks depth. Per frontend-aesthetics.md, avoid flat gradients.

2. **Inconsistent shadow usage**
   - Mix of `shadow-card`, `shadow-[0_10px_15px...]`, custom values
   - Should standardize to layered shadow system

3. **Hardcoded colors**

   ```tsx
   className = 'text-blue-700';
   ```

   Should use semantic tokens like `text-primary` or custom scale

4. **Generic empty states**
   - "No upcoming reservations" card is functional but bland
   - Opportunity for delightful illustration or animation

## External Resources

### Design Inspiration

- [Airbnb Guest Dashboard](https://airbnb.com) - Premium feel, warm photography, clear hierarchy
- [OpenTable User Profile](https://opentable.com) - Clean, restaurant-focused UI
- [Resy Reservations](https://resy.com) - Bold typography, strong visual identity

### Accessibility References

- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/) - Dashboard widgets, navigation
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/) - Color contrast, keyboard nav

### Design System References

- [Vercel Design](https://vercel.com/design) - Subtle depth, clean aesthetics
- [Stripe Dashboard](https://stripe.com) - Data-dense yet approachable
- [Linear App](https://linear.app) - Modern, performant, distinctive

**Why these matter:**

- Airbnb/OpenTable/Resy: Direct competitors in hospitality booking space
- Vercel/Stripe/Linear: Exemplify "stop scrolling" quality without AI slop patterns
- All demonstrate warm professionalism suitable for guest-facing portal

## Constraints & Risks

### Constraints

1. **Must use Shadcn UI primitives** - No custom base components without maintainer approval
2. **Must preserve existing functionality** - Zero breaking changes to user flows
3. **Mobile-first responsive** - 375px minimum, progressive enhancement
4. **Performance budgets** - Strict limits on FCP/LCP/CLS/TBT
5. **Accessibility baseline** - WCAG AA non-negotiable

### Risks

| Risk                                         | Impact | Mitigation                                                                           |
| -------------------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| Shadcn components don't support required UX  | High   | Audit available components early; document exceptions in plan.md                     |
| Performance regression from new animations   | Medium | Profile animations; respect `prefers-reduced-motion`; use `transform`/`opacity` only |
| Accessibility issues in custom variants      | High   | Test with keyboard-only navigation; run axe DevTools; capture artifacts              |
| Scope creep (redesigning beyond guest pages) | Medium | Strict boundary: only `/guest/*` routes; no layout/navbar changes unless necessary   |
| Breaking existing tests                      | Medium | Run E2E tests (`tests/e2e/guest/`) after each page; fix regressions immediately      |

## Open Questions (owner, due)

1. **Q:** Should we introduce a warm accent color (e.g., coral, amber) for CTAs to complement the blue scale?  
   **Owner:** Design/PM  
   **Due:** Before Phase 2 (plan.md)  
   **A:** UNCONFIRMED - will use blue-600 as primary CTA for now, can iterate

2. **Q:** Do guest pages need dark mode support?  
   **Owner:** PM  
   **Due:** Before Phase 2  
   **A:** UNCONFIRMED - current implementation is light mode only; defer dark mode to future iteration

3. **Q:** Should we add illustrations/graphics to empty states?  
   **Owner:** Design  
   **Due:** Before Phase 3 (implementation)  
   **A:** UNCONFIRMED - will use text + iconography for v1, graphics in future

4. **Q:** Are there any brand guidelines for typography beyond the custom font?  
   **Owner:** Design  
   **Due:** Before Phase 2  
   **A:** UNCONFIRMED - will follow frontend-aesthetics.md guidance: clear hierarchy, readable line heights

## Recommended Direction (with rationale)

### Visual Direction

**1. Color Palette**

- **Keep:** Blue scale (trust/reliability aligns with booking platform)
- **Add:** Warm neutral backgrounds (off-white, cream) instead of pure white
- **Accent:** Use blue-600 for primary CTAs; green for success states
- **Rationale:** Blue = trust (hospitality industry standard), warm neutrals = approachable

**2. Typography**

- **Keep:** 'Nab a Table Cereal App' custom font
- **Enhance:** Increase contrast between heading weights (700-800 for hero, 600 for subheads)
- **Scale:** Use fluid typography for hero sections (`clamp()` for responsive sizing)
- **Rationale:** Custom font provides brand distinctiveness; clear hierarchy improves scannability

**3. Backgrounds & Depth**

- **Replace:** Flat `from-blue-50 to-white` gradient
- **With:** Layered approach:
  - Subtle warm gradient on hero (cream → off-white)
  - Noise texture overlay (per frontend-aesthetics.md) for warmth
  - Multi-layer shadows on cards (0 1px, 0 4px, 0 16px)
- **Rationale:** Avoids AI slop; creates premium feel; maintains readability

**4. Motion & Interaction**

- **Add:** Subtle hover lift on cards (`transform: translateY(-2px)`)
- **Add:** Smooth transitions on CTAs (150ms ease-out)
- **Add:** Staggered entrance animations for lists (per frontend-aesthetics.md)
- **Respect:** `prefers-reduced-motion` with instant fallbacks
- **Rationale:** Micro-interactions = delight; respect accessibility

**5. Layout & Spacing**

- **Increase:** White space around sections (py-12 → py-16 on desktop)
- **Asymmetry:** Use 1.6:1 grid ratio (dashboard already does this well)
- **Generous:** Touch targets 48px minimum on mobile
- **Rationale:** Breathing room = premium; asymmetry = interest

### Component Strategy

**Shadcn Components to Use:**

1. **Card** - Standardize all content containers
2. **Badge** - Status indicators, labels
3. **Button** - CTAs, navigation
4. **Separator** - Visual dividers
5. **Avatar** - User profile icons
6. **Tabs** - Bookings page (upcoming/past)
7. **Dialog** - Modals (if needed)
8. **Toast** - Notifications (success/error feedback)

**Custom Variants Needed:**

1. Card: `featured` (large hero booking), `compact` (list items)
2. Badge: `status` (booking states), `metric` (stat pills)
3. Button: `cta` (primary actions), `ghost` (tertiary)

**No Custom Primitives** - All built on Shadcn base

### Implementation Phases

**Phase 1: Dashboard** (highest visibility)

- Revamp hero section (gradient, typography, spacing)
- Standardize card components (featured booking, upcoming list, sidebar)
- Add micro-interactions (hover states, entrance animations)

**Phase 2: Bookings List**

- Tab navigation (Shadcn Tabs)
- Card grid with consistent spacing
- Empty states with personality

**Phase 3: Profile Page**

- Form styling (inputs, labels, validation)
- Settings cards
- Save state feedback (Toast)

**Phase 4: Individual Booking & Receipt**

- Detail pages with generous white space
- Print-friendly receipt styling
- Action buttons (cancel, modify)

### Success Metrics

1. **Lighthouse Score:** Performance ≥ 90, Accessibility = 100
2. **Axe DevTools:** 0 critical/serious issues
3. **Core Web Vitals:** All green (FCP/LCP/CLS within budgets)
4. **Visual QA:** Passes "stop scrolling" test (distinctive, not generic)
5. **User Feedback:** Subjective - feels premium, trustworthy, easy to use

### Definition of Ready (DoR) Checklist

- [x] Scope & success criteria are clear/measurable
- [x] Reuse patterns documented (Shadcn components, existing card styles)
- [x] Risks identified with mitigation strategies
- [x] External resources linked with rationale
- [x] Recommended direction defined (visual + component strategy)
- [ ] Open questions answered by stakeholders (Design/PM)
- [x] Owner & reviewers assigned (frontmatter)

**Next Step:** Proceed to Phase 2 (plan.md) once open questions resolved, or proceed with assumptions documented.
