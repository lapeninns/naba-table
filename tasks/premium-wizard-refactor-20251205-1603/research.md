# Research: Premium Guest Experience Refactor — Wizard Components

---

task: premium-wizard-refactor
timestamp_utc: 2025-12-05T16:03:37Z
owner: github:@amanshresthaa
reviewers: []
risk: medium
flags: []
related_tickets: []

---

## Requirements

### Functional

- Refactor existing wizard components without breaking current behavior
- Apply premium visual design (glassmorphism, animations, enhanced spacing)
- Implement responsive bento-grid layouts for Plan Step
- Add edit functionality to Review Step
- Enhance Confirmation Step with celebration animations

### Non-functional (a11y, perf, security, privacy, i18n)

- All validation errors must render inside `aria-live="polite"` regions
- Logical tab order between form fields and sticky footer actions
- Focus-visible and keyboard-usable controls
- Accessible names for all interactive elements
- Performance: avoid layout thrashing, use compositor-friendly animations

## Existing Patterns & Reuse

### Components to Reuse

- `@shared/ui/button` - Button component with variants
- `@shared/ui/card` - Card, CardHeader, CardContent, CardTitle, CardDescription
- `@shared/ui/badge` - Badge component
- `@shared/ui/separator` - Separator for visual dividers
- `@shared/ui/accordion` - Accordion for collapsible sections
- `@shared/ui/form` - Form, FormField, FormControl, FormLabel, FormMessage
- `@shared/ui/input` - Input component
- `@shared/ui/checkbox` - Checkbox component
- `@shared/ui/progress` - Progress bar
- `@shared/lib/cn` - Class name utility

### Existing Patterns Identified

1. **Wizard Context**: `useWizardContext`, `useWizardState`, `useWizardActions`, `useWizardNavigation`
2. **Type System**: `StepAction`, `BookingDetails`, `State` in `model/reducer.ts`
3. **Design Tokens**: Guest theme with `--guest-*` CSS variables
4. **Animation Classes**: `animate-fade-in`, `animate-scale-in`, `animate-slide-up` in globals.css
5. **Error Boundary**: `StepErrorBoundary` for step-level error handling

### Typography & Spacing Tokens (from globals.css)

- Guest text hero: 2.5rem mobile, 3rem desktop
- Guest section: 1.5rem (24px)
- Guest card padding: 1.5rem
- Guest radius: sm (0.5rem), md (0.75rem), lg (1rem), xl (1.5rem)

## External Resources

- Shadcn UI patterns (already in codebase)
- Tailwind CSS utility classes
- No framer-motion in package.json - will use CSS animations

## Constraints & Risks

### Constraints

1. No framer-motion available - use CSS animations from globals.css
2. Must preserve all existing StepAction types and interfaces
3. Cannot change step order or validation semantics
4. Must use `@/*` import aliases

### Risks

1. **Medium**: Complex responsive layouts may introduce layout bugs
2. **Low**: Animation performance on low-end devices
3. **Low**: Breaking existing form state synchronization

## Open Questions (owner, due)

- None - all requirements clear from task specification

## Recommended Direction (with rationale)

### Approach

1. Create new helper utilities for action grouping (decouple from component)
2. Extract types to local `types.ts` files where not exists
3. Use CSS keyframe animations (already defined) for motion effects
4. Apply design tokens from guest-theme consistently
5. Maintain backward compatibility with existing prop interfaces

### Key Decisions

- Use CSS shake animation for Terms validation (no external deps)
- Use CSS confetti alternative (scale-in check animation) for Confirmation
- Keep accordion for Time selection but add proactive time slot grid
- Use grid layout with responsive breakpoints for bento effect
