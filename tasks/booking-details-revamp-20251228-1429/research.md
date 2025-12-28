---
task: booking-details-revamp
timestamp_utc: 2025-12-28T14:29:58Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Booking Details Revamp

## Requirements

- Functional:
  - Rebuild booking-details module with specified file structure and shadcn/ui primitives.
  - Fast-scannable header summary; clear actions; safe table assignment with confirmation.
  - Mobile-first dialog/sheet layout with tabs/accordion; desktop two-column layout.
  - Click-to-copy for key details with feedback.
  - Loading/empty/error states explicitly handled.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Full keyboard navigation, focus management, and accessible labels.
  - Avoid unnecessary re-renders; memoize derived lists.
  - No secrets in source; follow existing tailwind tokens and shadcn/ui patterns.

## Existing Patterns & Reuse

- Existing booking-details module in `src/components/features/dashboard/booking-details/` provides current baseline.
- Use shadcn/ui primitives from `src/components/ui/*` per `components.json`.
- Hooks and services for ops booking + tables live under `src/hooks/ops/**` and `src/services/ops/**`.
- Current dialog wrapper in `src/components/features/dashboard/BookingDetailsDialog.tsx` re-exports module.

## External Resources

- None required; no external specs referenced.

## Constraints & Risks

- Must follow SDLC phases; no code edits before plan review.
- UI changes require Chrome DevTools MCP QA artifacts.
- Must align with existing ops domain types (`OpsTodayBooking`, `OpsTodayBookingsSummary`) or document mapping.
- Large existing local changes; avoid broad refactors outside booking-details scope.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Use Sheet for mobile layout (bottom) and Dialog for desktop to optimize mobile ergonomics while staying consistent with existing shadcn/ui usage in the repo.
- Treat booking times as ISO strings in types; normalize to `Date` in utilities for calculations.
- Reuse existing ops types (`OpsTodayBooking`) but define minimal local types in `types.ts` for modular components.
- Implement table assignment logic in `useTableAssignment` hook and keep UI purely presentational.
