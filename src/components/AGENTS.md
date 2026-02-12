---
agents_version: 5.4
scope: subproject
extends: ../../AGENTS.md
last_updated: 2026-02-06
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
- Shadcn UI primitives are mandatory; do not introduce custom primitives or base components outside `src/components/ui`.

## Accessibility

- Semantic HTML first. Add ARIA only when needed.
- Ensure keyboard navigation and visible focus states.

## MCP usage

- Shadcn MCP is required for new or updated primitives.
- Chrome DevTools MCP for UI verification.
