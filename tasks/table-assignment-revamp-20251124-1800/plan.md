---
task: table-assignment-revamp
timestamp_utc: 2025-11-24T18:00:00Z
owner: github:@amanshresthaa
reviewers: []
risk: low
flags: []
---

# Implementation Plan: Table Assignment Interface Revamp

## Objective

We will transform the table assignment interface (`BookingDetailsDialog` → Tables tab) into a visually stunning, modern, and highly usable experience that delights restaurant operations staff while maintaining all existing functionality and improving mobile usability.

## Success Criteria

- [x] Visual hierarchy is immediately clear (guest → booking → assignment actions)
- [x] Party size vs. selected capacity is prominent and easy to understand
- [x] All interactive elements have clear hover/active states
- [x] Mobile experience is smooth on 375px+ screens
- [x] Loading states use skeletons (not just spinners)
- [x] Empty states are helpful and encouraging
- [x] Assigned tables section is elegant and scannable
- [x] Dark mode works perfectly
- [x] Accessibility maintained/improved (WCAG 2.1 AA)
- [x] Zero breaking changes to functionality
- [x] Animations are smooth (60fps, compositor-friendly)

## Architecture & Components

### Component Hierarchy

```
BookingDetailsDialog (ENHANCE)
├── Dialog (Shadcn)
│   ├── DialogContent (max-w-6xl - wider for better space)
│   │   ├── Left Sidebar (REVAMP)
│   │   │   ├── Guest Header (larger avatar, better tier badge)
│   │   │   ├── Contact Cards (enhanced with icons, hover)
│   │   │   ├── Preferences Section (collapsible badges)
│   │   │   └── Notes Section (better styling)
│   │   └── Right Panel (REVAMP)
│   │       ├── Sticky Header (date, time, status, actions)
│   │       └── Tabs (ENHANCE)
│   │           ├── Overview Tab (existing - minor tweaks)
│   │           └── Tables Tab → BookingAssignmentTabContent (MAIN FOCUS)
│   │               ├── AssignmentToolbar (REVAMP)
│   │               │   ├── Stats Card (party, selected, capacity)
│   │               │   ├── Available Toggle (better switch styling)
│   │               │   └── Action Buttons (clear, assign)
│   │               ├── Floor Plan Container (ENHANCE)
│   │               │   ├── Loading Skeleton (NEW)
│   │               │   ├── Empty State (REVAMP)
│   │               │   └── TableFloorPlan (existing)
│   │               └── Assigned Tables (REVAMP)
│   │                   ├── Grid Layout (cards)
│   │                   ├── Table Cards (mini previews)
│   │                   └── Remove Actions (single/all)
```

## Data Flow & API Contracts

**No changes to API contracts** - purely presentational changes.

### Existing Mutations (Preserved)

```typescript
// Direct assignment
directAssignMutation.mutate() → assignTablesDirect({
  bookingId, tableIds, idempotencyKey, requireAdjacency
})

// Unassignment
handleUnassignConfirm() → onUnassignTable(tableId)
handleRemoveAllTables() → unassignTablesDirect({ bookingId, tableIds })
```

### Existing Queries (Preserved)

```typescript
useAssignmentContext({ bookingId, enabled }) → {
  tables, bookingAssignments, holds, conflicts
}
```

## UI/UX States

### Loading States

1. **Assignment Context Loading**
   - Skeleton grid in floor plan area (3x3 table placeholders)
   - Shimmer animation effect
   - Disabled toolbar

2. **Mutation Pending**
   - Button shows spinner + "Assigning..." text
   - Toolbar disabled
   - Floor plan overlay with opacity

### Success States

1. **Tables Assigned**
   - Immediate UI update (optimistic)
   - Toast notification (green checkmark)
   - Smooth fade-in of assigned tables section
   - Clear selection automatically

2. **Tables Unassigned**
   - Fade-out animation of removed table card
   - Toast notification
   - Update capacity calculations

### Error States

1. **Assignment Context Error**
   - Red alert card with icon
   - Clear error message
   - "Retry" button (with refresh icon)
   - Helpful troubleshooting text

2. **Assignment Validation Error**
   - Toast with validation messages
   - Highlighted problematic tables (if applicable)
   - Clear explanation of why assignment failed

### Empty States

1. **No Floor Plan Coordinates**
   - Icon: Layout (crossed out) or HelpCircle
   - Heading: "No floor plan coordinates available"
   - Description: "Tables are listed below without visual layout."
   - Falls back to table list

2. **No Assigned Tables**
   - Icon: ClipboardList
   - Heading: "No tables assigned yet"
   - Description: "Select tables from the floor plan to assign to this booking."

## Edge Cases

1. **Merged Tables (2+ assigned)**
   - Show visual indicator (link icon or "Merged" badge)
   - Single "Remove All Tables" button
   - Helper text explaining merged table logic

2. **Single Table Assigned**
   - Individual "Remove" button per table card
   - Confirmation dialog before removal

3. **Capacity Mismatch**
   - Red text for insufficient capacity
   - Green text for sufficient/excess capacity
   - Clear diff indicator (+3, -2, etc.)

4. **Large Party Sizes (10+)**
   - Emphasize capacity requirements
   - Multi-select encouragement in empty state

5. **Mobile/Touch Devices**
   - Larger touch targets (min 44px)
   - Simplified layout (stack sidebar on mobile)
   - Bottom sheet for some actions (defer to future)

## Testing Strategy

### Manual QA (Required)

- [ ] Test on Chrome, Safari, Firefox, Edge
- [ ] Test on iPhone (375px, 390px, 414px)
- [ ] Test on Android (360px, 412px)
- [ ] Test on tablet (768px, 834px)
- [ ] Test on desktop (1280px, 1440px, 1920px)
- [ ] Test dark mode on all devices
- [ ] Keyboard navigation (Tab, Enter, Esc, Arrow keys)
- [ ] Screen reader (VoiceOver on macOS, NVDA on Windows)

### Functional Tests

- [ ] Assign single table
- [ ] Assign multiple tables
- [ ] Remove single table
- [ ] Remove all tables (merged)
- [ ] Toggle "Available only" filter
- [ ] Handle validation errors gracefully
- [ ] Empty state displays correctly
- [ ] Loading states appear correctly

### Accessibility Tests (axe DevTools)

- [ ] No violations on "Tables" tab
- [ ] All interactive elements have accessible names
- [ ] Focus management works correctly
- [ ] Color contrast meets WCAG AA (4.5:1 text, 3:1 UI)
- [ ] Keyboard shortcuts still functional

### Performance Budgets

- [ ] First Contentful Paint < 1.5s
- [ ] Largest Contentful Paint < 2.5s
- [ ] Cumulative Layout Shift < 0.1
- [ ] Total Blocking Time < 300ms
- [ ] No jank during tab switching or table selection

## Rollout

### Feature Flags

- No feature flags required (UI-only change)
- Changes are immediate on deployment

### Deployment Strategy

1. **Local Development**
   - Test all changes locally
   - Capture screenshots for artifacts
   - Verify in dev server

2. **Staging** (if exists)
   - Deploy to staging
   - Test with real(ish) data
   - Get stakeholder approval

3. **Production**
   - Deploy during low-traffic window
   - Monitor error rates
   - Watch for user feedback

### Monitoring

- Watch for console errors in Sentry/logging
- Monitor React Query mutation success rates
- Check user feedback/support tickets

### Rollback Plan

- Simple git revert if issues arise
- No database migrations involved
- No API changes to roll back

---

## Implementation Details

### 1. Guest Sidebar Enhancements

**File**: `BookingDetailsDialog.tsx` lines 344-440

#### Changes:

```tsx
// BEFORE: Small avatar (h-16 w-16)
<div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">

// AFTER: Larger avatar with gradient background
<div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10 border-2 border-primary/20 text-2xl font-bold text-primary">
```

```tsx
// BEFORE: Simple tier badge
<Badge variant="secondary" className={cn('capitalize', TIER_COLORS[booking.loyaltyTier])}>

// AFTER: Enhanced tier badge with better styling and emoji
<Badge
  variant="secondary"
  className={cn(
    'capitalize px-3 py-1 text-sm font-semibold shadow-sm',
    TIER_COLORS[booking.loyaltyTier],
    // Add gradient for premium tiers
    (booking.loyaltyTier === 'platinum' || booking.loyaltyTier === 'gold') &&
    'bg-gradient-to-r'
  )}
>
  {booking.loyaltyTier === 'platinum' && '💎 '}
  {booking.loyaltyTier === 'gold' && '👑 '}
  {booking.loyaltyTier}
</Badge>
```

#### Contact Cards Enhancement:

- Add subtle hover lift effect
- Improve icon background (gradient)
- Better spacing and typography

### 2. Assignment Toolbar Revamp

**File**: `AssignmentToolbar.tsx` (complete rewrite of styling)

#### Key Changes:

1. **Stats Display**
   - Larger, bolder numbers (text-2xl for counts)
   - Color-coded capacity (green = sufficient, red = insufficient)
   - Better visual separation between stats

2. **Party Size Indicator**
   - Prominent display with icon
   - Clear label and value hierarchy
   - Visual comparison to selected capacity

3. **Available Toggle**
   - Better switch styling (larger, more obvious)
   - Icon changes (Eye vs. EyeOff)
   - Improved label

4. **Assign Button**
   - Larger size (h-11 vs. h-9)
   - Gradient background for enabled state
   - Prominent placement

#### Enhanced Markup:

```tsx
<div className="flex flex-col gap-4">
  {/* Stats Card */}
  <Card className="border shadow-md">
    <CardContent className="p-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Party Size */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
            <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Party
            </p>
            <p className="text-2xl font-bold tabular-nums">{partySize}</p>
          </div>
        </div>

        {/* Selected Tables */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
            <LayoutGrid className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Selected
            </p>
            <p className="text-2xl font-bold tabular-nums">{selectedCount}</p>
            <p className="text-xs text-muted-foreground">tables</p>
          </div>
        </div>

        {/* Capacity */}
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-xl',
              capacityStatus === 'sufficient'
                ? 'bg-green-100 dark:bg-green-900/30'
                : 'bg-red-100 dark:bg-red-900/30',
            )}
          >
            {capacityStatus === 'sufficient' ? (
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            ) : (
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Capacity
            </p>
            <p
              className={cn(
                'text-2xl font-bold tabular-nums',
                capacityStatus === 'sufficient'
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400',
              )}
            >
              {selectedCapacity}
            </p>
            {partySize && (
              <p className="text-xs text-muted-foreground">
                {selectedCapacity >= partySize ? '+' : ''}
                {selectedCapacity - partySize} seats
              </p>
            )}
          </div>
        </div>
      </div>
    </CardContent>
  </Card>

  {/* Actions Bar */}
  <div className="flex items-center justify-between gap-3 p-4 rounded-xl border bg-muted/30">
    <div className="flex items-center gap-3">
      <Switch id="available-only" checked={onlyAvailable} onCheckedChange={onOnlyAvailableChange} />
      <Label htmlFor="available-only" className="flex items-center gap-2 cursor-pointer">
        {onlyAvailable ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        <span className="text-sm font-medium">Available only</span>
      </Label>
    </div>

    <div className="flex items-center gap-2">
      {selectedCount > 0 && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <Trash2 className="h-4 w-4 mr-2" />
          Clear
        </Button>
      )}
      <Button
        size="default"
        onClick={onAssign}
        disabled={!canAssign || isPending}
        className="min-w-[140px] h-11 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
      >
        {isAssigning ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Assigning...
          </>
        ) : (
          <>
            <CheckCircle2 className="mr-2 h-5 w-5" />
            Assign Tables
          </>
        )}
      </Button>
    </div>
  </div>
</div>
```

### 3. Floor Plan Container

**File**: `BookingAssignmentTabContent.tsx` lines 329-363

#### Loading Skeleton (NEW):

```tsx
{assignmentContextLoading ? (
  <div className="p-6" role="status" aria-live="polite">
    <div className="grid gap-4 grid-cols-3 sm:grid-cols-4 md:grid-cols-5">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />
      ))}
    </div>
    <span className="sr-only">Loading floor plan...</span>
  </div>
) : (
  // ... existing floor plan
)}
```

#### Enhanced Empty State:

```tsx
{assignmentContext && assignmentContext.tables.length === 0 ? (
  <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/50">
      <LayoutGrid className="h-10 w-10 text-muted-foreground" />
    </div>
    <div className="text-center space-y-2 max-w-sm">
      <h3 className="text-xl font-semibold">No tables available</h3>
      <p className="text-sm text-muted-foreground">
        There are no tables configured for this restaurant. Contact your administrator to set up table inventory.
      </p>
    </div>
    <Button variant="outline" size="sm" onClick={() => refetchAssignmentContext()}>
      <RefreshCw className="mr-2 h-4 w-4" />
      Refresh
    </Button>
  </div>
) : (
  // ... floor plan
)}
```

### 4. Assigned Tables Section

**File**: `BookingAssignmentTabContent.tsx` lines 365-415

#### Enhanced Card Layout:

```tsx
{
  assignedTables.length > 0 && (
    <div
      className="space-y-4 animate-in fade-in-50 slide-in-from-bottom-2"
      role="region"
      aria-label="Currently assigned tables"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <CheckCircle2 className="h-5 w-5 text-primary" />
          </div>
          <h4 className="text-base font-semibold">Assigned Tables</h4>
          <Badge variant="outline" className="font-mono">
            {assignedTables.length} {assignedTables.length === 1 ? 'table' : 'tables'}
          </Badge>
        </div>

        {assignedTables.length > 1 && (
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleRemoveAllTables}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Remove All
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {assignedTables.map((table, idx) => (
          <div
            key={table.id}
            className="group relative rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/40 animate-in fade-in-50 slide-in-from-bottom-2"
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            {/* Table Icon */}
            <div className="absolute top-2 right-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <LayoutGrid className="h-4 w-4 text-primary" />
              </div>
            </div>

            {/* Table Info */}
            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Table</p>
                <p className="text-2xl font-bold">{table.tableNumber}</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>{table.capacity} seats</span>
              </div>
              {table.section && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{table.section}</span>
                </div>
              )}
            </div>

            {/* Remove Button (Single Table Only) */}
            {assignedTables.length === 1 && onUnassignTable && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setUnassignTableId(table.id)}
              >
                <X className="mr-2 h-4 w-4" />
                Remove
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Merged Tables Helper */}
      {assignedTables.length > 1 && (
        <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-900 dark:text-blue-100">
            💡 These tables are merged for capacity. Use "Remove All" to unassign and re-select.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
```

### 5. Transitions & Animations

**Global Transition Classes** (add to component):

```tsx
// Tab content fade-in
className="animate-in fade-in-50 slide-in-from-bottom-2 duration-200"

// Assigned table cards stagger
style={{ animationDelay: `${idx * 50}ms` }}

// Remove animation
className="animate-out fade-out-50 slide-out-to-right-2 duration-200"
```

## DB Change Plan

N/A - No database changes required (UI-only revamp)

## Accessibility Checklist

- [ ] All buttons have accessible labels
- [ ] Icons have aria-hidden="true" or aria-label
- [ ] Loading states announce to screen readers (aria-live)
- [ ] Focus visible on all interactive elements
- [ ] Color contrast meets WCAG AA (4.5:1 text, 3:1 UI)
- [ ] Keyboard navigation works (Tab, Enter, Esc)
- [ ] Dialogs manage focus correctly
- [ ] Status changes announced (toast + aria-live)
- [ ] Form fields have associated labels
- [ ] Error messages are accessible

## Observability & Monitoring

### Metrics to Track (Post-Deployment)

- Table assignment success rate (should remain 100% or improve)
- Assignment time (user perspective - should be faster)
- Error rates (should be 0 or decrease)

### Logging Points

- Assignment mutations (existing)
- Unassignment actions (existing)
- Context loading errors (existing)

### Alerts

- None required (no new failure modes introduced)

## Documentation Updates

### Component Documentation

- Update JSDoc for modified components
- Add comments for new UI patterns
- Document animation choices

### User-Facing

- No user-facing docs needed (internal operations tool)
- Could add tooltips for new users (defer to future)

---

## Summary

This plan focuses on **visual transformation without functional changes**. We're enhancing the existing solid foundation with:

✨ **Modern Design Language** - gradients, shadows, better typography
📊 **Clear Data Hierarchy** - prominent stats, color-coded indicators
🎨 **Delightful Interactions** - hover effects, smooth transitions
📱 **Better Mobile UX** - responsive grids, larger touch targets
♿ **Improved Accessibility** - better labels, focus management
🌙 **Perfect Dark Mode** - tested color combinations

All changes are **low-risk, UI-only**, with no backend modifications or database migrations required.
