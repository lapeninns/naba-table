---
agents_version: 5.3
scope: subproject
extends: ../AGENTS.md
last_updated: 2025-12-19
owner: github:@amanshresthaa
profile: backend-ts
---

# AGENTS.md - Backend services (`server`)

Applies to backend domain logic and jobs under `server/**`.

## Scope

- Core domains: bookings, capacity, ops, customers, reservations, restaurants
- Jobs and queues (`server/jobs`, `server/queue`)
- Auth and security helpers (`server/auth`, `server/security`)

## Responsibilities

- Domain logic only. No React or UI concerns.
- Keep functions deterministic where possible.
- Separate pure logic from IO boundaries.

## Data access and errors

- Supabase is remote-only. Follow root migration rules.
- Validate external inputs at the boundary (API or job entry).
- Return stable domain errors; do not surface raw driver errors.

## Jobs and background work

- Jobs must be idempotent and retry-safe.
- Side effects should be explicit and traceable.
- Use guards to avoid double-processing (dedupe where needed).

## Performance

- Avoid N+1 query patterns; batch or cache.
- Keep hot paths lean (capacity, booking flows).

## MCP usage

- Supabase MCP for schema or query changes.
- Chrome DevTools MCP only if UI surfaces are involved.
