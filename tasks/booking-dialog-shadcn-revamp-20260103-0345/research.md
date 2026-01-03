---
task: booking-dialog-shadcn-revamp
timestamp_utc: 2026-01-03T03:45:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Research: Booking Dialog Shadcn Revamp

## Requirements

### Functional

- Revamp BookingDialog to use **Shadcn UI primitives only** (Dialog, Sheet, AlertDialog, Button, Badge, ScrollArea, etc.)
- Maintain all existing functionality:
  - Guest profile display (name, phone, email, party size, notes, dietary restrictions)
  - Table assignment panel with floor plan
  - Booking lifecycle actions (check-in, check-out, no-show, undo-no-show, cancel)
  - Responsive design (mobile sheet, desktop dialog)
  - Real-time validation and error handling
  - Keyboard shortcuts (Cmd/Ctrl+Enter for primary action, Escape to close)
- Ensure all components are accessible (WCAG compliant, keyboard navigable, screen reader friendly)

### Non-functional (a11y, perf, security, privacy, i18n)

- **A11y**: Full keyboard navigation, ARIA labels, focus management, semantic HTML
- **Perf**: Meet budgets (FCP ≤2s, LCP ≤2.5s, CLS ≤0.10, TBT ≤200ms on mobile 4× CPU throttled)
- **Security**: No sensitive data in console/logs; proper input sanitization
- **Privacy**: Customer data displayed only to authenticated ops users
- **i18n**: Prepare for future localization (use consistent text formatting utilities)

## Existing Patterns & Reuse

### Current Implementation Analysis

**BookingDialog.tsx** (500+ lines):

- Uses Shadcn Dialog/Sheet/AlertDialog primitives ✅
- Custom components in `components/` subfolder:
  - `DialogHeader` - booking status, countdown, close button
  - `GuestProfilePanel` - guest info, booking metadata, dietary restrictions
  - `TableAssignmentPanel` - wrapper for table assignment UI
  - `BookingStatCard`, `BookingStatusBadge`, `ArrivalCountdown`, `ClickToCopy`, `ContactInfoRow`
- Uses hooks: `useIsMobile`, `useToast`, `useGlobalShortcuts`, `useQueryClient`
- Grid layout: 2-column (left: guest profile, right: table assignment)
- Footer actions: Copy summary, Call guest, No-show, Cancel, Primary action (dynamic)

**BookingAssignmentTabContent.tsx** (600+ lines):

- Full table assignment UI with floor plan
- Uses `AssignmentToolbar`, `ValidationChecks`, `TableFloorPlan`
- Direct assignment mutation via `useBookingService`
- Real-time validation and error handling
- Manages selected tables state, assigned tables display
- Handles TABLES_NOT_FOUND error with cleanup

### Shadcn Primitives Available

From `components/ui/`:

- Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
- Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
- AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, etc.
- Button, Badge, Alert, AlertDescription, ScrollArea, Skeleton
- Tabs, TabsList, TabsTrigger, TabsContent (can use for multi-section layout)
- Card, CardHeader, CardTitle, CardDescription, CardContent (for panel sections)
- Separator (for visual breaks)

### Anti-patterns Identified

- ❌ Some custom mini-components that could be replaced with Shadcn Card/Badge compositions
- ❌ Hardcoded color classes (e.g., `bg-emerald-600`) instead of semantic Shadcn variants
- ❌ Custom grid layouts where Shadcn Card compositions could provide better structure
- ❌ Inconsistent spacing/padding patterns across panels

## External Resources

- [Shadcn UI Documentation](https://ui.shadcn.com/) - component API reference
- [WAI-ARIA Authoring Practices Guide (APG)](https://www.w3.org/WAI/ARIA/apg/) - dialog patterns, focus management
- [Radix UI Dialog](https://www.radix-ui.com/primitives/docs/components/dialog) - underlying primitive documentation

## Constraints & Risks

### Constraints

- Must maintain exact same functionality (no feature regressions)
- Must pass existing tests (unit, integration, E2E, a11y)
- Must meet perf/a11y budgets (see AGENTS.md §4 Phase 4)
- Cannot change API contracts or backend integration
- Must use **only** Shadcn primitives (no custom base components)

### Risks

- **Medium risk**: Large component (500+ lines) with complex state management
- **Low risk**: Breaking existing booking flows if we change too much at once
- **Mitigation**: Incremental refactor, preserve logic, test thoroughly

## Open Questions (owner, due)

- Q: Should we split BookingDialog into smaller sub-components (e.g., GuestPanel, ActionsPanel, AssignmentPanel)?
  A: UNCONFIRMED - will decide in plan.md based on component size/complexity

- Q: Can we simplify the footer action logic using Shadcn Button variants?
  A: UNCONFIRMED - will analyze in plan.md

- Q: Should we use Shadcn Tabs for multi-section layout (Guest | Tables)?
  A: UNCONFIRMED - current 2-column grid works well; evaluate if tabs improve mobile UX

## Recommended Direction (with rationale)

**Approach**: Incremental Shadcn-first refactor with component composition

1. **Audit current component tree** - identify all custom components and see which can be replaced with Shadcn Card/Badge/Button compositions
2. **Replace custom components** with Shadcn primitives:
   - `BookingStatCard` → Shadcn Card with CardHeader/CardContent
   - `BookingStatusBadge` → Shadcn Badge with variant prop
   - `ClickToCopy` → Shadcn Button with copy icon
   - Keep domain-specific logic (e.g., `ArrivalCountdown`, `GuestProfilePanel`) but ensure they use Shadcn primitives internally
3. **Simplify layout** - use Shadcn Card compositions for left/right panels
4. **Standardize colors** - replace hardcoded colors with Shadcn semantic variants (primary, destructive, etc.)
5. **Preserve logic** - keep all hooks, mutations, validations, shortcuts intact
6. **Test at each step** - run lint, typecheck, unit tests after each component replacement

**Rationale**:

- DRY: Reuse Shadcn primitives instead of custom wrappers
- KISS: Simpler component tree, easier to maintain
- YAGNI: Don't over-engineer; focus on replacing custom components with standard primitives
- Accessibility: Shadcn primitives are pre-built with a11y in mind
- Consistency: Match the rest of the app which uses Shadcn extensively
