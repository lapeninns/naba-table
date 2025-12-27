---
task: routing-improvements
timestamp_utc: 2025-12-27T17:02:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Routing Improvements (Host Redirects, Dev Guard, Tests)

## Requirements

- Functional:
  - Ensure cross-host redirects from `app.localhost` to `localhost` are absolute URLs.
  - Avoid `www.localhost` redirect in development.
  - Ensure proxy routing tests are discoverable by Vitest.
  - Provide a lightweight routing smoke script for guest/app hosts.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No UI changes; no a11y impact.
  - Keep routing behavior consistent; avoid redirect loops.

## Existing Patterns & Reuse

- Routing logic lives in `src/proxy.ts`.
- Redirect rules defined in `next.config.js`.
- Route map in `route-map.json`.

## External Resources

- None.

## Constraints & Risks

- Next.js proxy mode requires only `src/proxy.ts` (no `middleware.ts`).
- Must not break production host routing or ops auth guards.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Adjust proxy to use absolute redirects for cross-host routing.
- Guard the www redirect in dev to avoid `www.localhost`.
- Move or include proxy tests in Vitest patterns.
- Add a small Node-based smoke script for host routing checks.
