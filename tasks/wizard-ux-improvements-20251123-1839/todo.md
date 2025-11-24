---
task: wizard-ux-improvements
timestamp_utc: 2025-11-24T01:07:00Z
owner: github:@amanshresthaa
reviewers: []
risk: low
flags: []
related_tickets: []
---

# TODO: Wizard UX/UI Improvements

## Phase 1: TimeSlotGrid Component

- [x] Increase button height from h-12 to h-14 on mobile (<640px)
- [x] Add active:scale-95 transform for touch feedback
- [x] Improve selected state contrast (bg-primary with better shadow)
- [x] Enhance loading skeleton grid
- [x] Add smooth transitions for all state changes
- [x] Test touch targets (≥44px)
- [x] Verify dark mode styling

## Phase 2: Calendar24Field Component

- [x] Change flex-row to flex-col on mobile (<640px)
- [x] Increase date/time label font size on mobile
- [x] Add visual separator between date and time sections
- [x] Improve Calendar component touch targets
- [x] Add subtle fade-in animation when time slots load
- [x] Better error state visibility
- [x] Test responsive breakpoints

## Phase 3: PartySizeField Component

- [x] Increase button size from size="icon" to larger variant on mobile
- [x] Add number display with better typography (larger, bold)
- [x] Add haptic-style feedback with scale animation
- [x] Improve button spacing (gap-4 on mobile)
- [x] Add min/max visual feedback
- [x] Test increment/decrement on touch devices

## Phase 4: OccasionPicker Component

- [x] Optimize grid columns for mobile (2 cols max)
- [x] Increase button height to h-12 minimum
- [x] Improve active/selected state contrast
- [x] Add smooth transitions
- [x] Test on small screens (320px)

## Phase 5: NotesField Component

- [x] Ensure textarea has proper mobile font-size (16px+)
- [x] Improve character counter visibility
- [x] Add subtle focus state enhancement
- [x] Test auto-resize behavior

## Phase 6: WizardStep Container

- [x] Add step progress indicator (Step 1 of 4)
- [x] Reduce horizontal padding on mobile (px-4 instead of px-6)
- [x] Improve card shadow on mobile
- [x] Add subtle slide-in animation when step changes
- [x] Optimize title typography for mobile
- [x] Test on various screen sizes

## Phase 7: PlanStepForm Layout

- [x] Ensure proper grid stacking on mobile
- [x] Optimize spacing between sections
- [x] Test Accordion interactions on mobile
- [x] Verify all responsive breakpoints

## Phase 8: ReviewStep Enhancement

- [x] Add icons to summary grid items (calendar, clock, users, etc.)
- [x] Improve mobile grid layout (single column)
- [x] Enhance card styling with better shadows
- [x] Add edit links for each section
- [x] Test readability on small screens

## Phase 9: Global Improvements

- [ ] Add smooth scroll behavior to form
- [ ] Improve focus management between steps
- [ ] Add skip-to-content for accessibility
- [ ] Ensure all colors meet WCAG contrast ratios
- [ ] Add loading state transitions

## Phase 10: Testing & Verification

- [ ] Manual mobile testing (iPhone, Android)
- [ ] Manual tablet testing (iPad)
- [ ] Manual desktop testing
- [ ] Dark mode verification
- [ ] Screen reader testing (VoiceOver/TalkBack)
- [ ] Keyboard navigation testing
- [ ] Lighthouse audit (mobile & desktop)
- [ ] axe DevTools scan
- [ ] Visual regression testing

## Post-Implementation

- [ ] Document changes in PR description
- [ ] Update Storybook examples (if applicable)
- [ ] Create verification.md with test results
- [ ] Add screenshots to artifacts folder
- [ ] Request code review
