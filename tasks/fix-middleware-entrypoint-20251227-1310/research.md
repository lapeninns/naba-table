---
task: fix-middleware-entrypoint
timestamp_utc: 2025-12-27T13:10:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Research: Restore Next.js Middleware Entry Point

## Requirements

- Functional:
  - Restore a valid Next.js middleware entry point (`middleware.ts` or `src/middleware.ts`).
  - Ensure routing/auth/CSRF logic in `src/proxy.ts` executes for all requests as before.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Security: ops guard and CSRF cookie issuance must be enforced globally.
  - Perf: avoid extra overhead beyond prior middleware behavior.

## Existing Patterns & Reuse

- Middleware logic currently lives in `src/proxy.ts` with `export default async function proxy` and `config.matcher`.
- Tests exist for routing logic in `src/middleware.test.ts` referencing `handleRouting`.

## External Resources

- None.

## Constraints & Risks

- Next.js 16 proxy mode rejects having both `proxy.ts` and `middleware.ts` (build error).
- Ensure proxy entry point is `src/proxy.ts` only.
- Local dev must set `NEXT_PUBLIC_ROOT_DOMAIN=localhost` for `app.localhost` routing.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Use Next.js proxy entry point (`src/proxy.ts`) only; do not add `middleware.ts`.
