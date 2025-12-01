---
task: modularize-booking-dialog
timestamp_utc: 2025-12-01T21:15:00Z
---

# Implementation Checklist

## Setup

- [x] Create task folder structure
- [ ] Create types.ts with shared interfaces
- [ ] Create constants.ts with TIER_COLORS

## Hooks Extraction

- [ ] Create useBookingDialogState.ts
- [ ] Create useKeyboardShortcuts.ts
- [ ] Create useBookingCountdown.ts
- [ ] Create hooks/index.ts barrel

## Components Extraction

- [ ] Extract DetailCard.tsx
- [ ] Extract ShortcutHint.tsx
- [ ] Extract GuestProfilePanel.tsx
- [ ] Extract BookingHeader.tsx
- [ ] Extract BookingOverviewTab.tsx
- [ ] Extract BookingHistoryDialog.tsx
- [ ] Extract KeyboardShortcutsDialog.tsx

## Main Refactor

- [ ] Update BookingDetailsDialog.tsx to use extracted modules
- [ ] Create index.ts barrel export
- [ ] Update imports in consuming files

## Verification

- [ ] Build passes (pnpm build)
- [ ] No type errors
- [ ] Lint passes

## Notes

- Assumptions: Existing external API is preserved
- Deviations: None expected
