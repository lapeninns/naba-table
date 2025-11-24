---
task: wizard-ux-improvements
timestamp_utc: 2025-11-24T01:07:00Z
owner: github:@amanshresthaa
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Wizard UX/UI Improvements

## Objective

We will enhance the reservation wizard's UX/UI to provide a premium, mobile-first experience that delights users while maintaining all existing functionality. This includes improving touch targets, visual hierarchy, micro-interactions, and responsive layouts across all wizard steps.

## Success Criteria

- [ ] All interactive elements meet 44×44px minimum touch target on mobile
- [ ] Responsive layouts work flawlessly from 320px to 1920px+ viewports
- [ ] Lighthouse Mobile Score ≥90 (Performance, Accessibility, Best Practices)
- [ ] Zero accessibility regressions (maintain WCAG 2.1 AA)
- [ ] All animations respect `prefers-reduced-motion`
- [ ] Dark mode support maintained across all changes
- [ ] Core Web Vitals within "Good" thresholds

## Architecture & Components

### Component Hierarchy

```
WizardStep (Container)
├── PlanStep
│   ├── Calendar24Field (Date/Time Selection)
│   ├── PartySizeField (Party Size Controls)
│   └── Accordion (Time/Occasion/Notes)
│       ├── TimeSlotGrid
│       ├── OccasionPicker
│       └── NotesField
├── DetailsStep
│   ├── Contact Form Fields
│   └── Preferences Accordion
├── ReviewStep
│   └── Summary Grid
└── ConfirmationStep
```

### Files to Modify

| Component         | Path                                                                                     | Changes                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `TimeSlotGrid`    | `reserve/features/reservations/wizard/ui/steps/plan-step/components/TimeSlotGrid.tsx`    | Larger buttons, better touch feedback, improved loading states          |
| `Calendar24Field` | `reserve/features/reservations/wizard/ui/steps/plan-step/components/Calendar24Field.tsx` | Mobile stacking, better visual hierarchy, enhanced date/time connection |
| `PartySizeField`  | `reserve/features/reservations/wizard/ui/steps/plan-step/components/PartySizeField.tsx`  | Larger buttons, better visual feedback, improved layout                 |
| `OccasionPicker`  | `reserve/features/reservations/wizard/ui/steps/plan-step/components/OccasionPicker.tsx`  | Enhanced button states, better mobile grid                              |
| `NotesField`      | `reserve/features/reservations/wizard/ui/steps/plan-step/components/NotesField.tsx`      | Improved mobile experience, better character counter                    |
| `WizardStep`      | `reserve/features/reservations/wizard/ui/WizardStep.tsx`                                 | Step progress indicator, improved mobile padding                        |
| `PlanStepForm`    | `reserve/features/reservations/wizard/ui/steps/plan-step/PlanStepForm.tsx`               | Better mobile grid layout                                               |
| `ReviewStep`      | `reserve/features/reservations/wizard/ui/steps/ReviewStep.tsx`                           | Enhanced summary card with icons, better mobile layout                  |

## Data Flow & API Contracts

No changes to data flow or API contracts. All modifications are presentational only.

## UI/UX States

### TimeSlotGrid States

- **Loading**: Skeleton grid with pulse animation
- **Empty**: No slots available message
- **Available**: Interactive grid with hover/active/disabled states
- **Selected**: Highlighted slot with primary color
- **Disabled**: Grayed out with reduced opacity

### Calendar24Field States

- **Idle**: Awaiting date selection
- **Date Selected**: Time input enabled, suggestions shown
- **Loading Dates**: Calendar with loading indicators on specific dates
- **Loading Times**: Time input with skeleton placeholder
- **Error**: Inline error messages

### PartySizeField States

- **Default**: Current party size displayed
- **Min Limit**: Decrement button disabled
- **Max Limit**: Increment button disabled
- **Changing**: Brief scale animation on value change

## Edge Cases

### Mobile Viewport Handling

- **320px**: Minimum supported width
- **Landscape mobile (568px - 844px)**: Optimize for horizontal space
- **Tablet (768px - 1024px)**: Hybrid layout with some 2-column sections
- **Desktop (1024px+)**: Full multi-column layout

### Touch Interaction

- **Accidental taps**: Require deliberate press (no instant triggers)
- **Scroll vs tap**: Proper touch-action and event handling
- **Multi-touch**: Disable zoom on form elements (viewport meta)

### Loading States

- **Slow network**: Show skeletons immediately, timeout after 10s
- **Failed requests**: Clear error messages with retry option
- **Partial data**: Graceful degradation

### Accessibility

- **Screen readers**: Proper ARIA labels and live regions
- **Keyboard navigation**: Full keyboard support, logical tab order
- **High contrast**: Sufficient contrast ratios in all states
- **Focus indicators**: Visible focus rings on all interactive elements

## Testing Strategy

### Unit Tests

- Component rendering with various props
- Interaction handlers (onClick, onChange)
- Conditional rendering based on state
- Accessibility tree structure

### Integration Tests

- Form submission flow
- Error state handling
- Loading state transitions
- Multi-step navigation

### E2E Tests

- Complete booking flow on mobile viewport
- Date/time selection with real data
- Form validation and error recovery
- Cross-browser compatibility (Safari, Chrome, Firefox)

### Manual Testing

- [ ] Visual regression on mobile (iPhone SE, iPhone 12, Pixel 5)
- [ ] Visual regression on tablet (iPad, iPad Pro)
- [ ] Visual regression on desktop (1920×1080, 2560×1440)
- [ ] Dark mode verification across all viewports
- [ ] Touch target verification (44×44px minimum)
- [ ] Screen reader testing (VoiceOver, TalkBack)
- [ ] Keyboard navigation testing

### Accessibility Testing

- [ ] axe DevTools scan (0 violations)
- [ ] Lighthouse Accessibility audit (100 score)
- [ ] WCAG 2.1 AA compliance check
- [ ] Color contrast verification (4.5:1 minimum)

### Performance Testing

- [ ] Lighthouse Performance audit (≥90 mobile, ≥95 desktop)
- [ ] Core Web Vitals measurement
- [ ] Bundle size analysis (no significant increase)
- [ ] Animation performance (60fps target)

## Rollout

### Phase 1: Component Enhancements (This PR)

1. Enhance `TimeSlotGrid` with better mobile UX
2. Improve `Calendar24Field` responsive layout
3. Polish `PartySizeField` interactions
4. Update `WizardStep` container styling
5. Add step progress indicator

### Phase 2: Additional Polish (Future)

- Add micro-interactions with spring animations
- Implement haptic feedback (vibration API)
- Add confetti/celebration animation on confirmation
- Enhance error states with illustrations

### Monitoring & Observability

**Metrics to track:**

- Wizard completion rate (by device type)
- Time spent on each step (by device type)
- Error rate per field
- Abandonment point analysis

**Dashboards:**

- Use existing analytics (no new instrumentation needed)
- Monitor Core Web Vitals via Google Search Console
- Track Lighthouse CI scores in PR checks

**Alerts:**

- None required (low-risk visual changes)

**Kill-switch:**

- Not applicable (no feature flags needed for UI improvements)

## DB Change Plan

Not applicable - no database changes required.

## Rollback Plan

### If Issues Arise

1. Revert PR via GitHub UI
2. Deploy previous version
3. No data migration needed (no schema changes)
4. No cache clearing needed

### Rollback Criteria

- Accessibility score drops below 95
- Mobile usability errors in Search Console
- User-reported UI breaking bugs
- Significant performance regression (>10% increase in LCP)

## Security & Privacy

No security or privacy implications. All changes are presentational CSS/JSX modifications.

## Monitoring Post-Launch

- Monitor Sentry for any new UI-related errors
- Check analytics for completion rate changes
- Review Lighthouse CI trends
- Monitor Core Web Vitals in production

## Additional Context

### Design Principles

1. **Mobile-First**: Design for mobile, enhance for desktop
2. **Progressive Enhancement**: Core functionality works everywhere
3. **Accessibility by Default**: WCAG 2.1 AA is the baseline
4. **Performance Budget**: Every byte counts
5. **Delightful Details**: Micro-interactions matter

### Implementation Notes

- Use Tailwind utility classes for consistency
- Leverage existing design tokens from `globals.css`
- Maintain existing component APIs (no breaking changes)
- Add comments for non-obvious responsive decisions
- Test in real devices when possible (not just DevTools)

### Known Limitations

- Safari date/time input styling limitations (acceptable)
- iOS Safari viewport height quirks (100vh issues) - mitigated with min-height
- Android keyboard overlay handling - rely on browser defaults
