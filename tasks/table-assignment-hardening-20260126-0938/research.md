---
task: table-assignment-hardening
timestamp_utc: 2026-01-26T09:38:31Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Research: Table Assignment Hardening

## Requirements

- Functional:
  - Enforce allocator adjacency as always-on (connected).
  - Enforce strict policy in quote flow: zone-lock enforcement, disallow capacity overflow fallback, fail fast on hold conflicts.
  - Keep pruning limits but surface early-exit/timeout guardrails in diagnostics/telemetry.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve deterministic results for same inputs.
  - Avoid performance regressions in selector.
  - Keep IO boundaries and validation rules consistent with server AGENTS.

## Existing Patterns & Reuse

- Feature flags parsed in `lib/env.ts` and consumed in `server/feature-flags.ts`.
- Quote logic and fallbacks in `server/capacity/table-assignment/quote.ts`.
- Selector pruning diagnostics in `server/capacity/selector.ts`.
- Adjacency requirement documented in `docs/BUSINESS_LOGIC.md`.

## External Resources

- N/A

## Constraints & Risks

- Behavior changes affect ops/booking flows; must be explicit and tested.
- Strict hold conflict handling may reduce successful quotes; needs telemetry visibility.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Remove adjacency mode configuration and hardcode connected enforcement.
- Tighten quote flow to strict policy (zone lock, no overflow, fail fast on hold conflicts).
- Add early-exit/timeout diagnostics to selector to preserve performance transparency.
