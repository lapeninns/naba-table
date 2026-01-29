---
task: a11y-remediation
timestamp_utc: 2026-01-29T11:01:00Z
owner: github:@codex
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: A11y Remediation (Marketing & Guest)

## Objective

We will resolve remaining Playwright accessibility violations across marketing and guest views so that the a11y suite passes and UI remains visually consistent.

## Success Criteria

- [ ] `pnpm test:e2e:a11y` passes with zero serious/critical issues.
- [ ] Heading order warnings resolved on guest pages.
- [ ] Manual QA via Chrome DevTools MCP captured in verification.

## Architecture & Components

- Landing: update badge/footer text contrast in `FactoryHomeClient` and related components.
- Booking: update status badge colors in `BookingComponents`.
- Shared: adjust beta badge contrast in `BrandLogo`.
- Guest: fix heading levels in guest profile/booking cards.

## Data Flow & API Contracts

- No API changes.

## UI/UX States

- No state changes; visual and semantic tweaks only.

## Edge Cases

- Ensure contrast fixes still look acceptable on dark/gradient backgrounds.
- Ensure heading hierarchy remains consistent with page-level titles.

## Testing Strategy

- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e:a11y`.
- Manual QA via Chrome DevTools MCP with screenshots/trace.

## Rollout

- No flags; direct deployment after CI passes.
