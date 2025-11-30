---
agents_version: 5.3
scope: subproject
extends: ../../../AGENTS.md
last_updated: 2025-11-30
owner: github:@ops-core
profile: service-ts
---

# AGENTS.md — Ops Services (`src/services/ops`)

> Inherits root `/AGENTS.md`. Applies to ops‑domain services under `src/services/ops/**`.

---

## Overview

This directory holds **operations domain services**:

- `allowedCapacities.ts`
- `bookings.ts`
- `customers.ts`
- `occasions.ts`
- `restaurants.ts`
- `tables.ts`
- `team.ts`
- `zones.ts`
- `index.ts` — service exports

These services encapsulate domain logic for **bookings, capacities, teams, tables, and restaurants**. They are used by hooks/components to avoid duplicating business rules.

---

## Responsibilities & Layering

Ops services are:

- **Domain‑level**: they understand business concepts like booking status, capacities, and zones.
- **UI‑agnostic**: they must not import React or components.
- **Boundary‑aware**: they typically sit in front of:
  - Database access (via Supabase)
  - External APIs
  - Route handlers (`src/app/api/**`)

Layer:

- Components → Hooks (`src/hooks/ops`) → **Services (`src/services/ops`)** → DB/API

---

## Input/Output & Types

- Derive types from shared definitions in `src/types/ops.ts` where possible.
- Services should:
  - Accept well‑typed inputs (e.g. booking IDs, date ranges, restaurant IDs).
  - Return domain objects or DTOs that hide underlying storage details.
- Prefer **pure functions** that return data (or throw domain errors) over functions with hidden side‑effects.

---

## Validation & Errors

Unlike internal helpers, services here _are_ allowed to validate, because they act as a system boundary:

- Validate critical inputs (IDs, date ranges, capacity limits) before performing operations.
- Throw or return **domain‑specific errors** (e.g. “BookingNotFound”, “CapacityExceeded”) rather than generic strings.
- Do not leak raw low‑level error objects (driver errors, raw Supabase messages) past this layer:
  - Map them to known domain errors or a typed “UnexpectedError” as appropriate.

---

## Supabase & Remote‑Only Rule

If these services talk to Supabase or other remote stores:

- Obey the root **Supabase: remote only** rule — no local Supabase.
- Migrations and schema shape live in the dedicated migration path, not here.
- For write operations:
  - Favor **idempotent** and **retry‑safe** patterns where possible.
  - Avoid long‑running transactions; break up large changes into chunks.

Record any migration/DB‑related behavior in the relevant task’s `plan.md` and `verification.md`.

---

## Testing

- Each non‑trivial service (bookings, capacities, etc.) must have tests that:
  - Verify core business rules (e.g., how capacities are computed, how bookings are filtered).
  - Cover error conditions (invalid inputs, missing entities).
- Tests should live alongside services (`__tests__` folder) or under a dedicated services test directory, following repo conventions.
- Where possible, mock remote dependencies and focus on deterministic domain behavior.

---

## Performance

- Ops is likely latency‑sensitive (dashboards, live updates, timelines). Services should:
  - Avoid unnecessary round‑trips or N+1 queries.
  - Use batching or prefetch strategies where reasonable.
- Any performance‑critical behavior or caching strategy should be called out in the service’s doc comments and in `research.md`/`plan.md` for changes.

---

## MCP Usage in `src/services/ops`

- Use **Supabase MCP** (Phase 2/3) for:
  - Inspecting schema impacts when changing queries.
  - Validating that planned schema changes will support new service behavior.
- Use **Context7 MCP** to find prior art on similar ops flows (bookings, dashboards, etc.) before introducing new patterns.

---

## Links

- Root AGENTS: `/AGENTS.md`
- Hooks: `src/hooks/ops/**`
- App routes: `src/app/**`
- Types: `src/types/ops.ts`
