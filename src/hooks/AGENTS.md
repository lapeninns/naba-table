---
agents_version: 5.3
scope: subproject
extends: ../../AGENTS.md
last_updated: 2025-11-30
owner: github:@web-core
profile: web-hooks
---

# AGENTS.md — Hooks (`src/hooks`)

> Inherits root `/AGENTS.md`. Applies to all React hooks under `src/hooks/**`.

---

## Overview

This directory contains **custom React hooks**:

- `app/` — app‑level hooks and tests (`app/__tests__`)
- `ops/` — operations‑centric hooks (`useOpsBooking`, `useOpsBookingsList`, `useOpsOperatingHours`, etc.)
- Generic utilities:
  - `use-copy-to-clipboard.ts`
  - `use-countdown.ts`
  - `use-debounced-value.ts`
  - `useGlobalShortcuts.ts`

Hooks bridge components, contexts, and services — they are the main place for UI‑adjacent state and orchestration.

---

## General Hook Rules

- Hooks **must** be named `useSomething`.
- Hooks **must not** be called conditionally; follow the Rules of Hooks.
- Keep hooks **focused**:
  - One clear responsibility (e.g., “fetch and shape bookings list for ops dashboard”).
  - Prefer composing smaller hooks rather than building a mega‑hook.
- No direct DOM manipulation (except for very targeted cases where absolutely necessary); prefer refs and React events.

---

## Layering

- **UI components (`src/components`)**  
  ↓
- **Hooks (`src/hooks`)** — coordinate data, side‑effects, and state  
  ↓
- **Services (`src/services/ops`), contexts (`src/contexts`), APIs (`src/app/api`)**

Guidelines:

- Hooks should call **services** and **contexts**, not raw DB clients.
- `ops` hooks should lean on:
  - `src/services/ops/**` for data access and domain logic.
  - `src/contexts/ops-services.tsx`, `src/contexts/ops-session.tsx` for session/service wiring.

Do **not**:

- Call Supabase or external APIs directly from hooks unless there is no shared service yet — and if you must, strongly consider promoting it to `src/services/ops`.

---

## Testing

- `src/hooks/app/__tests__` is the precedent for hook tests.
- All non‑trivial hooks (especially in `ops/`) should have tests that:
  - Exercise happy path
  - Check edge cases (empty data, error states)
  - Verify that state transitions and returned values are correct
- When adding a new hook:
  - Prefer colocated tests (`__tests__`) following existing patterns.
  - Document any noteworthy behavior or limitations in the hook’s JSDoc.

---

## Ops Hooks (`src/hooks/ops`)

Hooks under `ops/` drive core operational flows:

- Booking creation, updates, and real‑time changes
- Operating hours, service periods, team invitations
- Booking heatmaps, status summaries, today’s VIPs, etc.

For these hooks:

- Treat **correctness and latency** as first‑class concerns.
- Derive types from shared domain types (`src/types/ops.ts`) where possible.
- Avoid overfetching / N+1 calls — aggregate at the **service layer** instead.

---

## MCP Usage in `src/hooks`

- Use **Chrome DevTools MCP** (Phase 4) to inspect:
  - Network behavior resulting from hooks (request patterns, caching).
  - State transitions and perf on key interactions using hooks.
- Use **Context7 MCP** in **Phase 1** to:
  - Discover prior art hooks before inventing a new pattern.

---

## Links

- Root AGENTS: `/AGENTS.md`
- Contexts: `src/contexts/**`
- Services: `src/services/ops/**`
- Types: `src/types/ops.ts`
