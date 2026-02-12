---
agents_version: 5.4
scope: subproject
extends: ../../AGENTS.md
last_updated: 2026-02-06
owner: github:@amanshresthaa
profile: web-next
---

# AGENTS.md - Next.js routes (`src/app`)

Applies to all App Router routes, layouts, and route handlers under `src/app/**`.

## Scope

- Route groups like `(public)`, `guest`, and `app`
- Global shell files: `layout.tsx`, `error.tsx`, `not-found.tsx`, `providers.tsx`
- API route handlers: `src/app/api/**`

## Routing and layout rules

- Keep `page.tsx` files focused on composition and wiring.
- Put domain logic in `src/components`, `src/hooks`, and `src/services/ops`.
- Prefer server components by default; add `use client` only when needed.
- Provide explicit loading, empty, error, and success states.

## API route handlers

- Treat routes as system boundaries: validate input and enforce auth.
- Normalize errors and return stable error payloads.
- Do not leak secrets or raw database errors.
- Use shared helpers and services instead of duplicating logic.

## Performance and reliability

- Avoid request waterfalls; co-locate data fetching when possible.
- Protect guest flows and deep links from breaking changes.

## MCP usage

- Chrome DevTools MCP is required for UI changes.
- Use Codebase Retrieval (Augment) when changing route boundaries or data fetching strategy (server/client splits, route handlers).
- Use Shadcn MCP for new UI primitives.

## Dev Harness Routes (For UI QA)

When a UI route is blocked in local dev (auth/tenant gating, redirects, etc.), you may add a **dev-only harness route** to enable the mandatory Chrome DevTools MCP verification.

- Put harness pages under `src/app/(public)/dev/**` and call `enforceDevOnly()` from `src/app/(public)/dev/_shared/enforceDevOnly.ts` at the **server boundary**.
- If you need to verify `/app/*` path-prefix behavior (single-host mode) without going through the protected `src/app/app/(app)/layout.tsx`, add a parallel harness page under `src/app/app/dev/**` (outside the `(app)` route group) and reuse the same harness UI component.
