---
task: fix-mobile-horizontal-scroll
timestamp_utc: 2026-01-19T22:46:19Z
owner: github:@codex
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix Mobile Horizontal Scrolling

## Objective

We will remove the root causes of horizontal overflow on mobile so pages render without sideways scrolling at 320px while preserving desktop layout.

## Success Criteria

- [ ] No horizontal scroll at 320px width on affected pages.
- [ ] No content is clipped or hidden.
- [ ] Desktop layout remains intact.

## Architecture & Components

- `components/ButtonPopover.tsx`: replace `w-screen` width with viewport-safe width.
- `src/components/shared/BrandLogo.tsx`: adjust beta badge positioning on small screens.
- `src/app/globals.css`: add global responsive media rules + safe text wrapping.

## Data Flow & API Contracts

- No changes.

## UI/UX States

- No new states; ensure existing layouts reflow without overflow.

## Edge Cases

- Long unbroken strings (IDs, URLs, emails)
- Media assets without intrinsic sizes
- Popovers aligned to padded containers

## Testing Strategy

- Manual QA with Chrome DevTools MCP (mobile 320px + 375px + tablet + desktop)
- Verify popover alignment and navbar/logo rendering at 320px

## Rollout

- No feature flag; small CSS/layout adjustments.

## DB Change Plan (if applicable)

- Not applicable.
