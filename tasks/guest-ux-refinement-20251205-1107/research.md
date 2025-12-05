# Research: Guest-Facing UX/UI Refinement Pass

## Requirements

### Functional

- Comprehensive audit and refinement of all guest-facing pages
- Focus areas:
  - Layout & whitespace normalization
  - Padding & margins standardization
  - Typography hierarchy
  - Visual hierarchy improvements
  - Color & theming consistency
  - Component standardization
  - Interaction states audit
  - Forms & validation refinement
  - Responsiveness verification
  - Accessibility compliance
  - Content clarity improvements

### Non-functional

- WCAG AA compliance minimum
- Mobile-first responsive design
- Performance budgets: FCP ≤ 2.0s, LCP ≤ 2.5s, CLS ≤ 0.10
- Keyboard navigability
- Screen reader compatibility

## Existing Patterns & Reuse

### Design System Foundation

Located in:

- `/src/app/globals.css` - Core design tokens (728 lines)
- `/styles/tokens.css` - Spacing scale, typography, shadows (131 lines)
- `/tailwind.config.js` - Tailwind extensions

### Token System Identified

```css
/* Spacing Scale (4/8pt system) */
--sr-space-0 through --sr-space-12

/* Typography Scale */
--sr-font-size-xs through --sr-font-size-3xl
--sr-line-height-tight, snug, normal, relaxed

/* DLS Tokens (Airbnb-inspired) */
--dls-spacing-xxs through --dls-spacing-xxl
--dls-radius-sm, md, card, lg, modal, pill
--dls-shadow-subtle, elevated, floating
```

### Guest Theme System

```css
.guest-theme {
  --primary: 217 91% 60%; /* blue-500 */
  --secondary: 213 96% 93%; /* blue-100 */
  --accent: 213 100% 96%; /* blue-50 */
}
```

### Shared Guest UI Components

Located in `/src/components/guest/ui/GuestPrimitives.tsx`:

- `GuestSection` - Section wrapper with title, description, eyebrow
- `GuestHero` - Hero section with gradient background
- `GuestCard` - Card wrapper extending shadcn Card
- `GuestStatus` - Status alerts (info, success, warning, error)
- `GuestEmpty` - Empty state component
- `GuestError` - Error state component

### Shared Guest Layouts

Located in `/src/components/layouts/`:

- `GuestLayout.tsx` - For /guest/\* routes
- `MarketingLayout.tsx` - For /, /restaurants/\* routes
- `AuthLayout.tsx` - For /auth/\* routes
- `GuestNavbar.tsx` - Shared navigation (444 lines)
- `GuestBackground.tsx` - Premium gradient orbs

### Current Route Inventory

| Route                                | Layout          | Purpose              |
| ------------------------------------ | --------------- | -------------------- |
| `/`                                  | MarketingLayout | Landing page         |
| `/restaurants`                       | MarketingLayout | Restaurant discovery |
| `/restaurants/[slug]`                | MarketingLayout | Restaurant detail    |
| `/restaurants/[slug]/book`           | MarketingLayout | Booking wizard       |
| `/restaurants/[slug]/book/thank-you` | MarketingLayout | Confirmation         |
| `/auth/signin`                       | AuthLayout      | Authentication       |
| `/guest/dashboard`                   | GuestLayout     | Guest dashboard      |
| `/guest/bookings`                    | GuestLayout     | Bookings list        |
| `/guest/profile`                     | GuestLayout     | Profile management   |
| `/bookings/[bookingId]`              | GuestLayout     | Booking detail       |

## Identified Issues

### 1. Spacing Inconsistencies

- Mixed usage of Tailwind utilities vs CSS variables
- `space-y-12`, `space-y-10`, `space-y-8`, `space-y-6` used interchangeably for section gaps
- Inconsistent padding: `p-8 sm:p-10`, `p-6 sm:p-8`, `px-4 py-12`, etc.
- Card padding varies: `p-6`, `p-8`, `px-6 py-4`

### 2. Typography Inconsistencies

- Heading sizes vary: `text-2xl`, `text-3xl`, `text-4xl` without clear hierarchy
- Mixed font weights: `font-bold`, `font-semibold` on same level headings
- Tracking/letter-spacing applied inconsistently

### 3. Color Usage Issues

- Some hardcoded colors (`bg-blue-50`, `text-blue-700`) instead of semantic tokens
- Inconsistent border colors: `border-slate-100`, `border-slate-200`, `border-border`
- Shadow usage varies: `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl`

### 4. Component Consistency Issues

- Duplicate EmptyState component in `BookingListClient` vs using `GuestEmptyState`
- Card border-radius varies: `rounded-2xl`, `rounded-3xl`, `rounded-xl`
- Button roundness: mix of `rounded-full`, `rounded-xl`, `rounded-lg`

### 5. Interactive States

- Missing consistent hover/focus states on some cards
- Transition timing varies: `transition`, `transition-all`, `transition-colors`

### 6. Responsiveness Issues

- Some pages have inconsistent max-width: `max-w-6xl`, `max-w-5xl`, `max-w-md`
- Mobile padding inconsistent across pages

## Recommended Direction

### Phase 1: Create Standardized Design Tokens

1. Define semantic spacing tokens for sections, cards, buttons
2. Create typography scale with clear hierarchy
3. Standardize border-radius tokens
4. Define elevation/shadow scale

### Phase 2: Update Global Styles

1. Add utility classes for common patterns
2. Define standard animation timings
3. Create consistent focus-visible styles

### Phase 3: Refactor Components

1. Update GuestPrimitives with consistent tokens
2. Standardize GuestCard variants
3. Unify empty/error states
4. Enhance form components

### Phase 4: Page-by-Page Refinement

1. Landing page (`/`)
2. Restaurants list (`/restaurants`)
3. Restaurant detail (`/restaurants/[slug]`)
4. Booking wizard (`/restaurants/[slug]/book`)
5. Thank-you page
6. Sign-in page (`/auth/signin`)
7. Dashboard (`/guest/dashboard`)
8. Bookings list (`/guest/bookings`)
9. Profile page (`/guest/profile`)

## Constraints & Risks

- Must maintain backwards compatibility with existing components
- Cannot break the restaurant-facing (ops) interface
- Need to verify build succeeds after each change batch
- Performance impact of additional CSS must be minimal

## Open Questions

None - proceeding with refinement based on analysis.
