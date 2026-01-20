---
task: fix-mobile-horizontal-scroll
timestamp_utc: 2026-01-19T22:46:19Z
owner: github:@codex
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix Mobile Horizontal Scrolling

## Requirements

- Functional:
  - Identify and fix root causes of horizontal overflow on mobile.
  - Preserve desktop layout and functionality.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Maintain accessibility; do not hide overflow as a workaround.
  - Ensure responsive media and safe text wrapping.

## Existing Patterns & Reuse

- `reserve/app/responsive.css` already applies `max-width: 100%` and `height: auto` for media.
- `src/app/layout.tsx` exports `viewport` with `width: device-width` and `initialScale: 1` (already correct).

## Root Causes (from code audit)

- `components/ButtonPopover.tsx` uses `PopoverContent` with `w-screen`, which can exceed the viewport when aligned to a padded container.
- `src/components/shared/BrandLogo.tsx` positions the beta badge with `-right-10`, which can extend beyond the viewport on narrow screens.
- `src/app/globals.css` lacks a global media max-width rule and safe word wrapping, allowing large media or long unbroken strings to overflow.

## External Resources

- None required (internal issue)

## Constraints & Risks

- Must follow AGENTS SDLC phases; no coding before plan reviewed.
- No `overflow-x: hidden` unless explicitly justified.
- UI changes require Chrome DevTools MCP manual QA + artifacts.

## Open Questions (owner, due)

- Q: Which route/page(s) reproduce the horizontal scroll?
  A: UNCONFIRMED (need reproduction steps).

## Recommended Direction (with rationale)

- Replace `w-screen` popover width with a viewport-safe width (`100vw - padding`) to prevent overshoot.
- Adjust beta badge positioning at small breakpoints so it stays within the logo container.
- Add global responsive media constraints and safe word wrapping to prevent overflow from large assets or long strings.
