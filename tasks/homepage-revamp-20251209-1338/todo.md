---
task: homepage-revamp
timestamp_utc: 2025-12-09T13:38:00Z
owner: github:@factory-droid
reviewers:
  - github:@maintainers
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Scaffold landing components directory aligned to design system tokens.
- [ ] Import necessary shadcn primitives (Badge, Button, Input, Card) and ensure token usage matches `DesignSystem.md`.

## Core

- [ ] Implement `HeroSection` with NavBar/SearchBar cues and CTA links.
- [ ] Implement `MetricsStrip` (3 MetricTile-inspired cards with stats + badges).
- [ ] Implement `ExperienceShowcase` with ProfileCard/DataTable-inspired layout highlighting guest journey.
- [ ] Implement `FinalCTA` hero referencing CTA tokens.
- [ ] Compose sections inside `src/app/(public)/page.tsx`, removing legacy markup.

## UI/UX

- [ ] Validate responsiveness + semantics (headings order, lists, aria labels).
- [ ] Ensure focus-visible rings present on interactive elements.

## Tests

- [ ] Run `pnpm run lint`.
- [ ] Run `pnpm run test`.
- [ ] Manual Chrome DevTools MCP audit + attach artifacts (perf/a11y snapshot) in `verification.md`.

## Notes

- Assumptions: imagery replaced with token-based abstractions; no large external assets.
- Deviations: none yet.
