---
task: wizard-ux-improvements
timestamp_utc: 2025-11-23T18:39:00Z
owner: github:@amanshresthaa
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Research: Wizard UX/UI Improvements

## Requirements

### Functional

- Improve mobile-first responsive design for all wizard steps
- Enhance visual hierarchy and information density
- Improve touch targets and mobile interaction patterns
- Maintain all existing wizard functionality (date/time selection, party size, contact details, review)
- Ensure smooth transitions between steps

### Non-functional

- **Accessibility**: WCAG 2.1 AA compliance, proper ARIA labels, keyboard navigation
- **Performance**: Keep Core Web Vitals within budget (LCP < 2.5s, FID < 100ms, CLS < 0.1)
- **Mobile-first**: Design for 320px+ viewport widths with progressive enhancement
- **Security**: No changes to data handling or validation logic
- **Privacy**: Maintain existing privacy standards
- **i18n**: Keep text externalization-ready for future internationalization

## Existing Patterns & Reuse

### Current Component Architecture

The wizard is structured in 4 main steps:

1. **PlanStep** (`/steps/PlanStep.tsx`)
   - Date/Time selection via `Calendar24Field`
   - Party size via `PartySizeField`
   - Occasion/notes via expandable `Accordion`
   - Time slot grid for visual selection

2. **DetailsStep** (`/steps/DetailsStep.tsx`)
   - Contact form (name, email, phone)
   - Preferences accordion (save details, marketing, terms)
   - Already has good mobile layout

3. **ReviewStep** (`/steps/ReviewStep.tsx`)
   - Summary grid showing all booking details
   - Simple layout, could benefit from visual enhancement

4. **ConfirmationStep** (`/steps/ConfirmationStep.tsx`)
   - Final confirmation UI

### Reusable Components Inventory

- **Shadcn UI components** (already in use):
  - `Card`, `CardContent`, `CardHeader` for step containers
  - `Button`, `Input`, `Label` for form elements
  - `Calendar` for date picking
  - `Accordion` for collapsible sections
  - `Badge` for labels (Happy Hour, Drinks Only)
  - `Alert` for error states
- **Custom components**:
  - `TimeSlotGrid` - displays available time slots in a grid
  - `Calendar24Field` - combined date/time picker
  - `PartySizeField` - increment/decrement party size
  - `OccasionPicker` - toggle group for occasions
  - `NotesField` - textarea for special requests

### Design System (from `globals.css`)

- **Colors**: HSL-based system with proper light/dark modes
- **Typography**: Responsive clamp-based sizing
- **Spacing**: Consistent gap patterns (gap-3, gap-4, gap-6)
- **Animations**: Compositor-friendly (fade-in, fade-up, scale-in, etc.)
- **Shadows**: Layered depth system
- **Radius**: Consistent border-radius scale

## External Resources

- [Material Design - Mobile First](https://m3.material.io/) - Modern mobile interaction patterns
- [Apple HIG - Mobile](https://developer.apple.com/design/human-interface-guidelines/ios) - iOS best practices
- [WAI-ARIA APG - Forms](https://www.w3.org/WAI/ARIA/apg/patterns/) - Accessible form patterns
- [Web.dev - Mobile UX](https://web.dev/mobile-ux/) - Mobile performance and UX best practices

## Constraints & Risks

### Constraints

- Must maintain backward compatibility with existing wizard state management
- Cannot modify core business logic or validation
- Must work with existing Supabase API endpoints
- Should not require database schema changes
- Must maintain existing analytics tracking

### Risks

- **Low Risk**: Visual/CSS changes only, no logic modifications
- **Testing effort**: Need to verify across different viewport sizes (mobile, tablet, desktop)
- **Dark mode**: Must ensure all changes work in both light and dark modes
- **Safari quirks**: Some CSS features may need vendor prefixes

## Open Questions

1. **Q**: Should we add visual progress indicators between steps?
   **A**: Yes - will improve user orientation and reduce cognitive load

2. **Q**: Should mobile layout be single-column or can we use some side-by-side elements?
   **A**: Mobile should be primarily single-column, with side-by-side only for compact elements (e.g., date/time inputs that are 2-col on tablet+)

3. **Q**: Should we add micro-interactions/animations?
   **A**: Yes - subtle animations (fade-in, slide) enhance perceived performance and polish

4. **Q**: Should we optimize the time slot grid for thumb zones?
   **A**: Yes - larger tap targets with adequate spacing for mobile

## Recommended Direction

### Mobile-First Approach

1. **320px baseline**: Design for smallest common viewport
2. **Progressive enhancement**: Add complexity at breakpoints (640px, 768px, 1024px)
3. **Touch-optimized**: 44px minimum touch targets, adequate spacing
4. **Thumb-friendly**: Place primary actions in thumb zones

### Key Improvements

#### 1. **TimeSlotGrid Component**

- Increase button height from `h-12` (48px) to `h-14` (56px) on mobile
- Add more visual feedback on touch (scale animation, haptic feedback via CSS)
- Improve contrast for active/selected states
- Better loading states with skeleton grid

#### 2. **Calendar24Field Component**

- Stack date/time vertically on mobile (currently side-by-side)
- Larger touch targets for calendar day cells
- Better visual connection between date selection and time availability
- Add subtle animations when switching dates

#### 3. **PartySizeField Component**

- Larger increment/decrement buttons (currently just icon-sized)
- Better visual feedback on tap
- Consider haptic/visual feedback for limits (min/max party size)

#### 4. **WizardStep Container**

- Add step progress indicator (1 of 4, 2 of 4, etc.)
- Improve card padding on mobile (reduce horizontal padding)
- Better typography scale for mobile (larger headings, proper line-height)

#### 5. **Overall Layout**

- Reduce vertical spacing between sections on mobile to maximize screen real estate
- Use sticky headers/footers where appropriate
- Add smooth scroll behavior when moving between form fields
- Improve error state visibility (inline errors with icons)

### Visual Enhancements

- **Shadows**: More pronounced elevation for interactive elements
- **Colors**: Use accent colors for selected states (currently using primary)
- **Icons**: Add contextual icons (calendar, clock, users) for better scannability
- **Badges**: Enhance badge styling with better contrast and sizing
- **Borders**: Use subtle borders with hover/focus states

### Interaction Enhancements

- **Feedback**: Immediate visual feedback on all interactions
- **Transitions**: Smooth transitions between states (200-300ms)
- **Loading**: Better loading states (skeletons, spinners)
- **Errors**: Inline validation with clear error messages
- **Success**: Positive feedback when selections are made

## Success Metrics

- Mobile touch target compliance: 100% of interactive elements ≥44px
- Lighthouse Mobile Score: ≥90
- Accessibility Score: 100
- Core Web Vitals: All "Good" thresholds
- Visual regression: No unintended changes in desktop layouts
