---
task: premium-booking-left-panel
timestamp_utc: 2025-12-30T00:54:50Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Premium Booking Details Left Panel

## Requirements

- Functional:
  - Redesign the **desktop left panel** of the booking details dialog to feel premium, scannable, and polished.
  - Emphasize quick-glance clarity for ops staff (busy service context).
  - Preserve existing data and actions; no new features or data sources.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Maintain WCAG AA contrast and keyboard accessibility.
  - Avoid heavy animation; respect `prefers-reduced-motion`.
  - No layout shift or performance regression; keep DOM lightweight.

## Existing Patterns & Reuse

- `src/components/features/dashboard/booking-details/BookingDialog.tsx`
  - Left column: overview + contact sections (Cards, BookingStatCard, Accordion).
  - Uses shadcn primitives: `Card`, `Badge`, `Button`, `Accordion`, `Alert`, `Separator`, `ScrollArea`.
- `BookingStatCard`, `ArrivalCountdown`, `ClickToCopy`, `ContactInfoRow` already provide the data and structure.
- Shadcn registry contains `card` component (confirmed via MCP search).

## External Resources

- None required (UI restyle within existing patterns).

## Constraints & Risks

- Must follow AGENTS SDLC: requirements + plan before implementation.
- Avoid inline styles; use Tailwind utilities and existing tokens.
- Ensure the left panel remains readable under dense data and in narrow dialogs.
- Maintain mobile tab layout unchanged (scope is desktop left panel).

## Open Questions (owner, due)

- Should the premium look align with an existing brand palette (if any) beyond neutral + amber/emerald accents? (owner: github:@maintainers)
- Any explicit preference for keeping VIP tier colors (purple/gold/etc.) as-is? (owner: github:@maintainers)

## Recommended Direction (with rationale)

- Introduce a **layered surface** for the left column: warm neutral gradient + subtle border to signal a premium panel.
- Tighten **visual hierarchy** using section headers, consistent spacing, and refined card treatments.
- Keep functionality unchanged; apply polish through typography weight, spacing rhythm, and muted accent colors.
