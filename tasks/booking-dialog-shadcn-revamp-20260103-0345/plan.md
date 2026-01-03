---
task: booking-dialog-shadcn-revamp
timestamp_utc: 2026-01-03T03:45:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Booking Dialog Shadcn Revamp

## Objective

We will refactor BookingDialog and its sub-components to use **only Shadcn UI primitives** so that we achieve better consistency, maintainability, and accessibility across the ops dashboard.

## Success Criteria

- [ ] All custom components replaced with Shadcn Card/Badge/Button/etc. compositions
- [ ] No functionality regressions (all existing flows work identically)
- [ ] All tests pass (unit, integration, E2E, a11y)
- [ ] Perf budgets met (FCP ≤2s, LCP ≤2.5s, CLS ≤0.10, TBT ≤200ms)
- [ ] A11y: keyboard navigation, focus management, ARIA labels verified
- [ ] Code is simpler and more maintainable (reduced component count, cleaner structure)

## Architecture & Components

### Current Structure

```
BookingDialog
├── DialogHeader (custom)
├── GuestProfilePanel (custom wrapper)
│   ├── BookingStatCard (custom)
│   ├── ContactInfoRow (custom)
│   ├── ArrivalCountdown (custom logic component)
│   └── BookingStatusBadge (custom)
├── TableAssignmentPanel (custom wrapper)
│   └── BookingAssignmentTabContent
│       ├── AssignmentToolbar
│       ├── ValidationChecks
│       └── TableFloorPlan
└── Footer Actions (dynamic buttons)
```

### Target Structure (Shadcn-first)

```
BookingDialog (uses Shadcn Dialog/Sheet)
├── Header Section (Shadcn Card with colored accent border)
│   ├── Badge (Shadcn Badge for status)
│   ├── Countdown Timer (custom logic, Shadcn typography)
│   └── Close Button (Shadcn Button variant="ghost")
├── Body (2-column grid, responsive)
│   ├── Left Panel: Guest Profile (Shadcn Card)
│   │   ├── Card sections for booking info
│   │   ├── Button for copy/call actions
│   │   └── Badge for dietary/preferences
│   └── Right Panel: Table Assignment (Shadcn Card)
│       └── BookingAssignmentTabContent (refactored to use Cards)
└── Footer (Shadcn Button group)
    ├── Secondary actions (outline variant)
    └── Primary action (default variant with semantic color)
```

### Component Replacements

| Current Custom Component | Shadcn Replacement                    | Notes                                                     |
| ------------------------ | ------------------------------------- | --------------------------------------------------------- |
| `BookingStatCard`        | `Card` + `CardHeader` + `CardContent` | Use Card primitive with consistent spacing                |
| `BookingStatusBadge`     | `Badge` with `variant` prop           | Use `variant="default"` / `"secondary"` / `"destructive"` |
| `ClickToCopy`            | `Button` with `Copy` icon             | Standard Button with onClick handler                      |
| `ContactInfoRow`         | `div` with Shadcn typography          | Simple layout, no custom component needed                 |
| `DialogHeader`           | Shadcn `Card` with colored border     | Use Card with `border-l-4` accent for status tone         |

**Keep (domain-specific logic)**:

- `ArrivalCountdown` - contains time calculation logic
- `GuestProfilePanel` - orchestrates guest data layout (but refactor internals to use Cards)
- `TableAssignmentPanel` - wrapper for assignment context (refactor to use Card)

## Data Flow & API Contracts

**No API changes** - this is purely a UI refactor.

Existing props/contracts remain unchanged:

- `BookingDialogProps` - same interface
- Hooks (`useIsMobile`, `useToast`, `useGlobalShortcuts`, `useQueryClient`) - no changes
- Mutations (`onCheckIn`, `onCheckOut`, `onMarkNoShow`, etc.) - no changes

## UI/UX States

All existing states preserved:

- Loading (Skeleton components)
- Error (Alert with retry button)
- Empty (Alert with message)
- Success (normal display)
- Pending actions (disabled buttons, spinners)

## Edge Cases

- Large party sizes (10+ covers) - ensure Card layout doesn't break
- Long notes/dietary restrictions - use ScrollArea if needed
- Mobile viewport (375px) - Sheet should handle gracefully
- Keyboard-only navigation - verify focus management with Shadcn primitives
- Screen reader - verify ARIA labels and live regions

## Testing Strategy

### Unit Tests

- Test each refactored component in isolation
- Verify props are passed correctly to Shadcn primitives
- Test conditional rendering (status-based colors, action buttons)

### Integration Tests

- Verify booking dialog opens/closes correctly
- Verify actions (check-in, cancel, etc.) trigger correct mutations
- Verify table assignment flow works end-to-end

### E2E Tests

- Run existing Playwright tests for booking flow
- Add new tests for keyboard shortcuts (Cmd+Enter, Escape)

### Accessibility Tests

- Run axe-core checks on dialog (0 critical/serious issues)
- Manual keyboard navigation test
- Screen reader smoke test (VoiceOver/NVDA)

## Rollout

**No feature flag needed** - this is a UI refactor with no functional changes.

Steps:

1. Refactor components incrementally (one at a time)
2. Run lint/typecheck after each change
3. Manual QA in dev environment
4. Deploy to staging for full E2E test
5. Deploy to production once all tests pass

## Monitoring

- Watch for console errors in Sentry (filtered by "BookingDialog")
- Monitor booking flow completion rates (should remain stable)
- Track dialog interaction metrics (no regressions expected)

## Kill-switch

If critical bug discovered post-deploy:

- Rollback via Git revert + hotfix deploy
- Previous component version is preserved in Git history

## DB Change Plan

N/A - no database changes for this UI refactor.

## Notes

- Follow Frontend Aesthetics skill (skills/frontend-aesthetics.md) for color/typography choices
- Follow Style Principles skill (skills/style-principles.md) for DRY/KISS/YAGNI
- Use MCP Integration skill (skills/mcp-integration.md) for Shadcn MCP tool if available
