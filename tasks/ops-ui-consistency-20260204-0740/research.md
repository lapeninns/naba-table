---
task: ops-ui-consistency
timestamp_utc: 2026-02-04T07:40:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Ops UI Consistency + Performance

## Requirements

- Functional:
  - Standardize ops UI header/toolbar patterns across `/app/*` ops pages without changing behavior.
  - Keep CTA text/actions intact; only reorganize layout and shared components.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Focus-visible states only; reduced motion support; explicit transitions (no `transition-all`).
  - Keep list performance intact and avoid regressions.

## Existing Patterns & Reuse

- Dashboard, bookings, customers pages already use similar header + sticky toolbar constructs.
- Restaurant settings pages use `RestaurantSettingsPageShell` for consistent header + subnav.

## External Resources

- Vercel React best practices (internal skill) for rendering/perf guidance.

## Constraints & Risks

- Maintain behavior; avoid breaking routing and URL sync.
- Avoid file moves/deletions unless explicitly requested.
- Shadcn primitives only for new UI.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Introduce shared ops page header/toolbar components and rewire feature clients to use them.
- Replace `transition-all` with explicit transition properties to reduce layout thrash.
