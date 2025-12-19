---
agents_version: 5.3
scope: subproject
extends: ../../AGENTS.md
last_updated: 2025-12-19
owner: github:@amanshresthaa
profile: package-ui
---

# AGENTS.md - Components (`src/components`)

Applies to shared and feature components for the Next.js app.

## Structure

- `ui/` - primitives (Shadcn-based)
- `features/` - feature-specific UI
- `layouts/` and `layout/` - page shells
- `shared/`, `marketing/`, `landing/`, `auth/` - reusable UI

## Responsibilities

- `ui/` is presentational only, no domain knowledge.
- `features/` may know domain concepts but should not call DBs directly.
- Prefer hooks/services for data access (`src/hooks`, `src/services/ops`).

## Conventions

- Function components only. Keep props typed.
- Prefer composition over inheritance.
- Avoid inline styles unless absolutely necessary.
- Use repo tokens and utilities (`styles/tokens.css`, `src/app/globals.css`).

## Accessibility

- Semantic HTML first. Add ARIA only when needed.
- Ensure keyboard navigation and visible focus states.

## Testing

- Add tests for complex/critical components.
- Keep test files colocated where possible.

## MCP usage

- Shadcn MCP for new primitives.
- Chrome DevTools MCP for UI verification.
