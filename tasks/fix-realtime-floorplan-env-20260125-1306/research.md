---
task: fix-realtime-floorplan-env
timestamp_utc: 2026-01-25T13:06:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix production env validation for realtime floorplan

## Requirements

- Functional: Production build must pass env validation by ensuring `NEXT_PUBLIC_FEATURE_REALTIME_FLOORPLAN` is a valid boolean string.
- Non-functional (a11y, perf, security, privacy, i18n): No UI changes; do not commit secrets; follow SDLC and task artifacts.

## Existing Patterns & Reuse

- Locate existing env validation in `scripts/validate-env.ts` and reuse pattern for boolean defaults or required values.

## External Resources

- N/A (internal env validation only).

## Constraints & Risks

- Must not commit secrets; production value set via Vercel env or safe default in code.
- Follow SDLC order; no coding before plan reviewed.

## Open Questions (owner, due)

- Q: Should the env var be set in Vercel only, or should code accept a default? (owner: github:@maintainers, due: 2026-01-25)

## Recommended Direction (with rationale)

- Prefer setting the env var in Vercel production to an explicit "true"/"false". Only adjust validation if product decision allows a default.
