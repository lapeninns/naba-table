---
task: dashboard-header-polish
timestamp_utc: 2026-01-01T13:00:00Z
owner: github:@ai-agent
risk: low
---

# Implementation Plan: Dashboard Header Polish & Enhancement

## Objective

We will enhance the Operations Dashboard header with consolidated controls, touch gestures, improved loading states, and micro-animations so that mobile users have a premium, fluid experience.

## Success Criteria

- [x] Vertical space saved by consolidating date controls
- [x] Swipe left/right changes dates on touch devices
- [x] Loading skeleton matches new badge design
- [x] Smooth animations respect `prefers-reduced-motion`
- [ ] No performance regression (<16ms frame time)
- [ ] Touch gestures don't interfere with scroll

## Architecture & Components

### 1. **Consolidated Date Control**

**Component**: `HeatmapCalendar.tsx`

Current structure:

```
[Service Badges]
[Calendar Picker Button]
[← Current Date →]  (separate navigation)
```

New structure:

```
[Service Badges]
[Calendar Picker Button with embedded nav]
```

**State**: No new state; uses existing `handleShiftDate` callback

### 2. **Swipe Gesture Hook**

**New Hook**: `useDateSwipe.ts`

```typescript
interface SwipeConfig {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  threshold?: number;
}

function useDateSwipe(config: SwipeConfig): RefObject<HTMLElement>;
```

**Approach**:

- Touch event listeners on header element
- Track `touchstart` → `touchmove` → `touchend`
- Calculate delta, detect horizontal bias
- Trigger callback if threshold met

### 3. **Enhanced Loading Skeleton**

**Component**: `HeatmapCalendar.tsx` (loading state)

Match live badge layout:

```tsx
<div className="flex gap-2">
  <SkeletonText className="h-7 w-24 rounded-full" /> {/* SERVICE DATE */}
  <SkeletonText className="h-7 w-28 rounded-full" /> {/* bookings */}
  <SkeletonText className="h-7 w-24 rounded-full" /> {/* covers */}
</div>
```

### 4. **Micro-animations**

**CSS Classes** (Tailwind):

```css
/* Badge hover */
.badge-interactive {
  @apply transition-all duration-200 ease-out;
  @apply hover:scale-105 hover:shadow-md;
}

/* Button active */
.button-press {
  @apply active:scale-95 transition-transform duration-100;
}

/* Respect motion preferences */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Data Flow & API Contracts

No API changes. Uses existing:

- `handleShiftDate(days: number)` - shifts by ±1 day
- `onSelectDate(date: string)` - sets specific date

## UI/UX States

### Swipe Gesture States:

1. **Idle**: Normal display
2. **Touch Start**: User finger down
3. **Swiping**: Visual feedback (subtle transform)
4. **Swipe Complete**: Animate transition, trigger date change
5. **Swipe Cancelled**: Return to idle (< threshold)

### Animation States:

- **Hover**: Scale up, add shadow
- **Active/Press**: Scale down
- **Focus**: Ring outline (keyboard)

## Edge Cases

1. **Swipe during scroll**: Detect vertical movement, cancel horizontal swipe
2. **Multi-touch**: Ignore if > 1 touch point
3. **Fast swipe**: Debounce to prevent double-trigger
4. **Browser without touch**: Hook returns null ref, no-op

## Testing Strategy

### Unit Tests:

- Swipe detection logic (threshold, direction)
- Touch event handling

### Manual QA:

- **Chrome DevTools**: Device emulation, touch simulation
- **Physical Device**: Test on actual iPhone/Android
- **Keyboard Navigation**: Ensure calendar picker still works
- **Screen Reader**: ARIA labels intact

### Performance:

- **Chrome DevTools Performance**: Record swipe interaction
- **Target**: < 16ms frame time (60fps)
- **Lighthouse**: No CLS regression

## Rollout

- **No Feature Flag**: Low risk, progressive enhancement
- **Monitoring**: Track swipe usage via analytics (optional)
- **Kill-switch**: Remove swipe listener if performance issues detected

## Implementation Checklist

### Phase 1: Consolidate Controls

- [ ] Move date navigation arrows into calendar popover
- [ ] Add popover header with prev/next buttons
- [ ] Remove standalone navigation component
- [ ] Test keyboard navigation

### Phase 2: Swipe Gestures

- [ ] Create `useDateSwipe` hook
- [ ] Implement touch event handlers
- [ ] Add threshold & direction detection
- [ ] Apply to header element
- [ ] Test on touch device

### Phase 3: Loading State

- [ ] Update `HeatmapCalendar` skeleton
- [ ] Match pill layout (3 badges)
- [ ] Test loading transitions

### Phase 4: Micro-animations

- [ ] Add hover transitions to badges
- [ ] Add active states to buttons
- [ ] Implement `prefers-reduced-motion`
- [ ] Polish timing curves

### Phase 5: Verification

- [ ] Chrome DevTools MCP testing
- [ ] Performance profiling
- [ ] Accessibility audit
- [ ] Cross-browser smoke test
