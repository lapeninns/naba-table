---
task: premium-booking-left-panel
timestamp_utc: 2025-12-30T00:54:50Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Premium Booking Details Left Panel

## Objective

We will give ops staff a **premium, scannable left panel** in the booking details dialog so they can assess booking context quickly during service without adding new functionality.

## Success Criteria

- [ ] Desktop left panel feels premium and polished (layered surfaces, intentional hierarchy).
- [ ] Information is scannable at a glance (clear sectioning, consistent spacing).
- [ ] A11y intact (keyboard + contrast); no layout shift or perf regressions.

## Architecture & Components

- `BookingDialog.tsx`: update left-column wrapper + section styling only.
- Reuse shadcn primitives (`Card`, `Badge`, `Button`, `Accordion`, `Separator`) and existing BookingDetail components.
- No new components unless necessary; prefer class updates and minor markup grouping.

## Data Flow & API Contracts

- No changes. All data and actions remain as-is.

## UI/UX States

- Loading / Error / Empty: unchanged.
- Desktop layout: left column restyle only.
- Mobile tabs: unchanged.

## Visual Direction (Frontend Aesthetics)

- **Palette**: warm neutrals with restrained accents (stone/slate + amber/emerald), avoid purple-blue gradient.
- **Depth**: soft layered surfaces via subtle gradients + `shadow-sm`/`ring` patterns.
- **Hierarchy**: section headers with caps + divider rule; stat grid tightened for scan speed.
- **Motion**: minimal `transition-colors` only; respect `prefers-reduced-motion`.

## Edge Cases

- Missing contact details (phone/email) still display calm empty state.
- No table assigned state remains clear and visible within the new surface.

## Testing Strategy

- Manual UI QA via Chrome DevTools MCP (required): mobile/tablet/desktop, a11y, perf budgets.
- No new automated tests expected (styling-only change); update if layout logic changes.

## Rollout

- No feature flag (visual polish only). If requested, add `feat.booking.left-panel-premium`.

## DB Change Plan (if applicable)

- N/A
