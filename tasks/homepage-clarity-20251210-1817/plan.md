---
task: homepage-clarity
timestamp_utc: 2025-12-10T18:17:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Homepage clarity

## Objective

We will enable visitors to quickly understand the value of Nab a Table without feeling overwhelmed by text.

## Success Criteria

- [ ] Homepage hero and above-the-fold copy reduced and focused on 1-2 key messages.
- [ ] Core actions (search, view bookings, sign-in) remain prominent and accessible.
- [ ] Readability and visual hierarchy improve based on user feedback/QA.

## Architecture & Components

- Reuse existing `Home*Section` components in `src/components/landing/HomeSections.tsx`.
- Add inline SVG illustration component (pure JSX/SVG) within hero section right column, using existing tokens for colors.
- Keep MarketingLayout wrapper unchanged.

## Data Flow & API Contracts

- No API changes; homepage remains static with existing supabase user check for auth-aware CTAs.

## UI/UX States

- Loading / Empty / Error / Success (unchanged; primarily static content)

## Edge Cases

- Ensure hero search form remains accessible and functional after layout adjustments.
- SVG should degrade gracefully with prefers-reduced-motion and high-contrast modes (avoid animations/colors not in tokens).

## Testing Strategy

- Manual QA + axe via Chrome DevTools MCP for homepage route.
- Spot-check responsive layout on mobile/tablet/desktop.

## Rollout

- Feature flag: not required (content-only change).
- Exposure: 100% once approved.
- Monitoring: rely on existing marketing route monitoring.
- Kill-switch: revert commit if metrics regress.

## DB Change Plan (if applicable)

- Not applicable (no DB changes planned).
