---
agents_version: 5.3
scope: subproject
extends: ../AGENTS.md
last_updated: 2025-12-19
owner: github:@amanshresthaa
profile: hooks-legacy
---

# AGENTS.md - Legacy hooks (`hooks`)

This folder contains shared hooks referenced by path aliases.
Prefer `src/hooks` for new Next.js app work unless an existing feature already uses this folder.

## Rules

- Keep hooks focused and composable.
- Do not call Supabase directly from hooks unless there is no shared service.

## Testing

- Add tests for non-trivial hooks.
