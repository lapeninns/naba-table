---
agents_version: 5.3
scope: subproject
extends: ../../AGENTS.md
last_updated: 2025-12-19
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

## Testing

- Use `pnpm test` for relevant logic.
- Add focused tests for non-trivial route handlers.

## MCP usage

- Chrome DevTools MCP is required for UI changes.
- Use Next DevTools MCP when changing route boundaries or data fetching strategy.
- Use Shadcn MCP for new UI primitives.
