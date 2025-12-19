---
task: qa-regression-guest-profile
timestamp_utc: 2025-12-05T14:25:12Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Guest Booking & Profile Regression

## Requirements

- Functional: Run production-build app on port 3001 with `E2E_TEST_TOKEN=local-dev-token`; execute `pnpm test:e2e:guest` covering guest booking + profile CRUD; confirm ProfileManageForm labels are discoverable; verify e2e-login auth bypass works.
- Non-functional: Avoid touching Supabase schema; keep logs/artifacts under `test-results/`; follow AGENTS SDLC; ensure accessibility check focus on label associations.

## Existing Patterns & Reuse

- Use existing Playwright suite via `pnpm test:e2e:guest` (chromium project).
- Auth bypass uses `e2e-login` helper + `E2E_TEST_TOKEN`; no new scripts needed.
- Production-mode server via `pnpm build && pnpm start --port 3001` as per Next.js defaults.

## External Resources

- None required beyond local repo tooling.

## Constraints & Risks

- Port 3001 conflicts could block start.
- Long build/start time may exceed test timeouts if not warmed.
- Test data state in backing services could affect booking/profile assertions.

## Open Questions (owner, due)

- Need to confirm test baseURL matches port 3001 (verify in config) — owner: assistant, due: before test run.

## Recommended Direction (with rationale)

- Keep to existing Playwright workflow: build once, start server on 3001 with env token, run suite, capture logs/traces for failures into `test-results/`. Minimizes change and aligns with established e2e patterns.
