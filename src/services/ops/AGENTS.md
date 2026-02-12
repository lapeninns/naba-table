---
agents_version: 5.4
scope: subproject
extends: ../../../AGENTS.md
last_updated: 2026-02-06
owner: github:@amanshresthaa
profile: service-ts
---

# AGENTS.md - Ops services (`src/services/ops`)

Ops services encapsulate domain logic for bookings, customers, teams, tables, and restaurants.

## Responsibilities

- Domain-level logic only. No React imports.
- Accept typed inputs and return domain DTOs.
- Validate inputs at this boundary when needed.

## Errors and validation

- Use domain-specific errors (not raw driver errors).
- Map low-level errors to stable error types.

## Data access

- Supabase is remote-only.
- Avoid long-running transactions; prefer idempotent operations.
- Keep reads batched to avoid N+1 behavior.

## MCP usage

- Supabase MCP for schema impact checks.
- Codebase Retrieval (Augment) to find prior ops patterns.
