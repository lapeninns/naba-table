---
task: modularize-booking-dialog
timestamp_utc: 2025-12-01T21:15:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Modularize BookingDetailsDialog (SOLID Refactor)

## Objective

Refactor the 770+ line monolithic `BookingDetailsDialog.tsx` into focused, single-responsibility modules following SOLID principles to improve maintainability, testability, and extensibility.

## Success Criteria

- [ ] Main dialog reduced to <150 lines (orchestration only)
- [ ] Each extracted module has single responsibility
- [ ] All existing functionality preserved
- [ ] Build passes with no type errors
- [ ] Existing tests continue to pass

## Architecture & Components

### Module Structure

```
src/components/features/dashboard/booking-details/
├── index.ts                        # Barrel export
├── types.ts                        # Shared types
├── constants.ts                    # TIER_COLORS, shortcuts config
├── hooks/
│   ├── index.ts
│   ├── useBookingDialogState.ts    # Dialog open/close, tab state
│   ├── useKeyboardShortcuts.ts     # Keyboard handler
│   └── useBookingCountdown.ts      # Time intelligence
├── components/
│   ├── GuestProfilePanel.tsx       # Guest info sidebar
│   ├── BookingHeader.tsx           # Status + actions menu
│   ├── BookingOverviewTab.tsx      # Quick actions + details
│   ├── DetailCard.tsx              # Reusable card
│   ├── ShortcutHint.tsx            # Keyboard hint
│   ├── BookingHistoryDialog.tsx    # History modal
│   └── KeyboardShortcutsDialog.tsx # Shortcuts help
└── BookingDetailsDialog.tsx        # Thin orchestrator
```

### SOLID Mapping

| Principle | Implementation                                |
| --------- | --------------------------------------------- |
| **SRP**   | Each component/hook handles one concern       |
| **OCP**   | New tabs/dialogs can be added via composition |
| **LSP**   | N/A (no inheritance)                          |
| **ISP**   | Props scoped per component needs              |
| **DIP**   | Main dialog depends on component interfaces   |

## Data Flow

1. `BookingDetailsDialog` receives booking data + callbacks
2. Passes relevant slices to child components
3. Hooks manage local state (dialog open, keyboard, countdown)
4. Child components render UI, call action callbacks

## Testing Strategy

- Unit: Each hook tested in isolation
- Component: Each panel tested independently
- Integration: Full dialog tested for composition

## Rollout

- In-place refactor (no feature flag needed)
- Same external API maintained
