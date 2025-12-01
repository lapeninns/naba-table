---
task: modularize-booking-dialog
timestamp_utc: 2025-12-01T21:15:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Modularize BookingDetailsDialog Using SOLID Principles

## Requirements

- Functional: Break down 770+ line monolithic `BookingDetailsDialog.tsx` into focused modules
- Non-functional: Maintain existing functionality, improve maintainability, enable independent testing

## SOLID Violations in Current Implementation

### S - Single Responsibility Principle Violations

1. **BookingDetailsDialog** handles:
   - Dialog open/close state management
   - Guest profile display (avatar, tier, contact)
   - Booking details display (date, time, party size)
   - Lifecycle actions (check-in/out, no-show)
   - Keyboard shortcut handling
   - History dialog management
   - Shortcuts dialog management
   - Countdown timer logic
   - Table assignment coordination

### O - Open/Closed Principle

- Adding new tabs requires modifying the main component
- Adding new dialogs (history, shortcuts) requires editing main file

### L - Liskov Substitution Principle

- N/A for this component

### I - Interface Segregation Principle

- `BookingDetailsDialogProps` has many optional callbacks that aren't always needed
- Components receive props they don't use

### D - Dependency Inversion Principle

- Direct imports of specific implementations
- Hard-coded UI logic mixed with business logic

## Existing Patterns & Reuse

- `BookingAssignmentTabContent` - already extracted (good pattern)
- `BookingActionButton`, `BookingStatusBadge` - reusable atomic components
- `DetailCard`, `ShortcutHint` - inline helper components (should be extracted)
- Shadcn UI components used throughout (continue this pattern)

## Recommended Module Structure

```
src/components/features/dashboard/booking-details/
├── index.ts                      # Barrel export
├── types.ts                      # Shared types, props interfaces
├── constants.ts                  # TIER_COLORS, keyboard shortcuts config
├── hooks/
│   ├── index.ts
│   ├── useBookingDialogState.ts  # Dialog state, controlled/uncontrolled
│   ├── useKeyboardShortcuts.ts   # Keyboard handler logic
│   └── useBookingCountdown.ts    # Countdown timer logic
├── components/
│   ├── GuestProfilePanel.tsx     # Left sidebar - guest context
│   ├── BookingHeader.tsx         # Status, date/time, dropdown menu
│   ├── BookingOverviewTab.tsx    # Quick actions + booking details grid
│   ├── DetailCard.tsx            # Reusable detail card
│   ├── ShortcutHint.tsx          # Keyboard hint display
│   ├── BookingHistoryDialog.tsx  # History dialog
│   └── KeyboardShortcutsDialog.tsx # Shortcuts help dialog
└── BookingDetailsDialog.tsx      # Main orchestrator (thin)
```

## Constraints & Risks

- Breaking changes: Must maintain existing props API
- Performance: Additional modules shouldn't impact bundle size significantly (tree-shaking)
- Testing: Each module should be independently testable

## Open Questions

- Q: Should we create a v2 behind a feature flag or refactor in-place?
  A: Refactor in-place - this is internal restructuring, not behavior change

## Recommended Direction

Apply SOLID principles by:

1. **SRP**: Each module has one clear responsibility
2. **OCP**: New dialogs/tabs can be added without modifying existing code
3. **DIP**: Main dialog depends on abstractions (props interfaces)
4. **ISP**: Props are scoped to what each component needs
