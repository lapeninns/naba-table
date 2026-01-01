---
task: dashboard-header-polish
timestamp_utc: 2026-01-01T13:00:00Z
owner: github:@ai-agent
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Research: Dashboard Header Polish & Enhancement

## Requirements

### Functional:

1. **Consolidate Controls**: Merge date navigation arrows into calendar picker popover
2. **Swipe Gestures**: Add touch swipe support for date navigation on mobile
3. **Enhanced Loading**: Update skeleton to match new badge layout
4. **Micro-animations**: Add polish transitions and hover effects

### Non-functional:

- **Performance**: Swipe gestures must not impact scroll performance
- **Accessibility**: Keyboard navigation must remain fully functional
- **Touch**: Swipe should work on touch devices only (not mouse drag)
- **Progressive Enhancement**: Swipe is optional; buttons work without JS

## Existing Patterns & Reuse

### Date Navigation:

- Current: Separate prev/next buttons + calendar picker button
- Pattern: Similar to calendar apps (swipe between dates)

### Swipe Implementation:

- **Library Option**: `react-swipeable` (18KB gzipped)
- **Native Option**: Touch events with `TouchEvent` API
- **Recommendation**: Native implementation (zero deps, better control)

### Loading Skeletons:

- Current: `SkeletonText` component from `@/components/ui/skeletons`
- Need: Match badge layout (3 rounded pills)

### Animations:

- Using Tailwind's built-in animations
- CSS transitions for micro-interactions
- `prefers-reduced-motion` support required

## External Resources

- [MDN Touch Events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events) - Native touch API
- [WCAG Animation Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html) - Motion accessibility

## Constraints & Risks

### Constraints:

- Must not break keyboard navigation
- Swipe must not interfere with scroll
- Calendar picker must remain accessible
- No new dependencies if possible

### Risks:

- **Medium**: Swipe detection conflicts with scroll (mitigation: detect horizontal vs vertical)
- **Low**: Animation jank on low-end devices (mitigation: use transform/opacity only)
- **Low**: Touch event browser compatibility (mitigation: feature detection)

## Open Questions

- Q: Should swipe be enabled on tablet/desktop with mouse drag?
  A: No, touch-only for mobile simplicity
- Q: Swipe threshold distance?
  A: 50px minimum to avoid accidental triggers

## Recommended Direction

1. **Consolidate Controls**: Move prev/next arrows inside the calendar popover
   - Save ~60px vertical space on mobile
   - Keep calendar trigger button visible
   - Add navigation inside popover header

2. **Swipe Gestures**: Implement with native Touch API
   - Horizontal swipe only
   - 50px threshold, directional bias
   - Haptic feedback via scale animation
   - Feature detection, graceful degradation

3. **Loading Skeleton**:
   - 3 rounded pill skeletons matching badge layout
   - Shimmer animation
   - Proper spacing

4. **Micro-animations**:
   - Badge hover: scale(1.05) + shadow
   - Button active: scale(0.95)
   - Transitions: 200ms ease-out
   - Respect `prefers-reduced-motion`
