# Implementation Checklist

---

task: premium-wizard-refactor  
timestamp_utc: 2025-12-05T16:03:37Z
owner: github:@amanshresthaa

---

## Setup

- [x] Create task directory structure
- [x] Create research.md with requirements analysis
- [x] Create plan.md with implementation plan

## Core Refactoring

### New Files Created

- [x] `reserve/features/reservations/wizard/utils/groupActions.ts` - Extracted action grouping utility
- [x] `reserve/features/reservations/wizard/ui/types.ts` - Shared UI types

### Modified Files

- [x] **WizardNavigation.tsx**
  - [x] Glass effect container (`bg-white/80 backdrop-blur-xl`)
  - [x] Floating capsule on desktop (`md:max-w-3xl md:rounded-full`)
  - [x] Responsive layout (stacked mobile, inline desktop)
  - [x] Slide-in animation via `animate-slide-up`
  - [x] Decoupled `groupActions` into separate utility
  - [x] Extracted `ActionButton` sub-component

- [x] **WizardStep.tsx**
  - [x] Enhanced shadow (`shadow-2xl shadow-black/5`)
  - [x] Subtle border (`border-white/20`)
  - [x] Roomy padding (`px-6 py-6 sm:px-10 sm:py-8`)
  - [x] Thin progress line at top
  - [x] Extracted `ProgressIndicator` and `TitleSection` sub-components

- [x] **PlanStep.tsx**
  - [x] Preserved business logic
  - [x] Fixed curly quote character issue

- [x] **PlanStepForm.tsx**
  - [x] Bento grid layout (3 cols desktop, 2 cols tablet, 1 col mobile)
  - [x] Removed accordion for time selection
  - [x] Proactive TimeSlotGrid display
  - [x] Empty state with calendar icon when no date selected
  - [x] BentoCard sub-component for consistent styling

- [x] **Mobile Responsiveness**
  - [x] Fix Step 2 button layout (stacking on mobile, 50/50 width)
  - [x] Responsive font sizing for buttons (prevent truncation)
  - [x] Improve Time Picker (Smart Select with Grouping vs Native Wheel)

- [x] **Final Polish**
  - [ ] Cross-browser verification
  - [ ] Animation smoothness check

- [x] **DetailsStep.tsx**
  - [x] Two visual sections: "Your Details" and "Preferences"
  - [x] Touch-friendly input height (`h-12`)
  - [x] Shake animation for Terms validation
  - [x] Error messages in `aria-live="polite"`
  - [x] Extracted `SectionHeader` and `ContactInput` sub-components

- [x] **ReviewStep.tsx**
  - [x] Ticket/receipt metaphor with gradient background
  - [x] Dashed separator with decorative notches
  - [x] Grid of `DetailItem` components
  - [x] Edit buttons with pencil icons for each section
  - [x] Notes spans full width

- [x] **ConfirmationStep.tsx**
  - [x] Celebration animation (`animate-celebrate`)
  - [x] Circular progress countdown ring
  - [x] Prominent "Cancel Redirect" button
  - [x] "Add to Calendar" and "Get Directions" buttons
  - [x] Extracted `CircularProgress`, `CelebrationIcon`, `ActionButtons` sub-components

### CSS Additions

- [x] Added `@keyframes shake` animation
- [x] Added `.animate-shake` utility class
- [x] Added `@keyframes celebrate` animation
- [x] Added `.animate-celebrate` utility class

## Testing & Verification

- [x] TypeScript compilation passes for all wizard files
- [ ] Manual QA via Chrome DevTools (pending)
- [ ] Keyboard navigation testing (pending)
- [ ] Responsive layout verification (pending)

## Notes

- **Pre-existing build error**: `src/app/guest/bookings/[bookingId]/receipt/page.tsx` has a type error unrelated to this refactoring
- **No framer-motion**: Used CSS animations instead (shake, celebrate, slide-up, fade-in)
- **Import aliases**: All imports use `@/*` pattern as required

## Batched Questions

- None - all requirements were clear
