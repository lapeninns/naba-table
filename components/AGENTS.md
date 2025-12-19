---
agents_version: 5.3
scope: subproject
extends: ../AGENTS.md
last_updated: 2025-12-19
owner: github:@amanshresthaa
profile: ui-legacy
---

# AGENTS.md - Legacy components (`components`)

This folder contains legacy/shared React components referenced by path aliases.
Prefer `src/components` for new Next.js UI work unless an existing feature already uses this folder.

## Rules

- Keep changes minimal and compatible with existing consumers.
- Do not add new UI primitives here unless there is a clear reuse need.
- Keep styling consistent with repo tokens and existing patterns.

## Accessibility

- Follow root a11y rules for any UI changes.

## Testing

- Add or update tests if behavior changes.
