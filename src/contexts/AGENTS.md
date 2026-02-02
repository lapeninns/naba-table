---
agents_version: 5.3
scope: subproject
extends: ../../AGENTS.md
last_updated: 2025-12-10
owner: github:@web-core
profile: react-contexts
---

# AGENTS.md — React Contexts (`src/contexts`)

> Inherits root `/AGENTS.md`. Applies to all React context providers, finite-state machines, and cross-route state containers stored in `src/contexts/**`.

## Overview

- Hosts shared booking/ops session contexts (`booking-state-machine.tsx`, `booking-offline-queue.tsx`, `ops-session.tsx`, etc.).
- Owns **application state orchestration** (wizard steps, optimistic queues, auth/session bridging) while staying UI-agnostic.
- Export surface is consumed by `src/app/**`, `src/components/features/**`, and `hooks/**` — changes ripple broadly, so treat as critical infrastructure.

## Build Commands

- `pnpm lint --filter "src/contexts..."` (or full `pnpm lint`) — ensure type safety.
- `pnpm run dev` — smoke-test flows that rely on updated providers.

## Guidelines

1. **State Ownership & Layering**
   - Contexts own **long-lived, multi-component state** only; colocate short-lived UI state inside components.
   - Keep contexts free of DOM access; move UI concerns to hooks/components.
   - Prefer finite-state machine patterns (e.g., XState-like modeled state) with explicit events over ad-hoc booleans.
2. **Side Effects & Services**
   - Delegate data fetching/mutations to `src/hooks` or `src/services/ops`; contexts orchestrate responses and expose derived state.
   - All network/service calls must handle errors and surface actionable statuses (`idle | loading | success | error`).
3. **Type Safety & Serialization**
   - Export serializable snapshots for SSR-friendly hydration; avoid storing non-serializable objects (DOM nodes, class instances).
   - Keep public context value types in `src/types` when used broadly.
4. **Performance & Memoization**
   - Use `useMemo`/`useCallback` or store slices to prevent unnecessary re-renders of consumers.
   - Split providers when unrelated state updates cause churn.
5. **A11y & UX Hooks**
   - Maintain explicit actions for focus management or announcements, but emit events so components manage DOM specifics.

## Links

- Root AGENTS: `/AGENTS.md`
- Hooks: `src/hooks/**`
- Services: `src/services/ops/**`
- Components: `src/components/**`
