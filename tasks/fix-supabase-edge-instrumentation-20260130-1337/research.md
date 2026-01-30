---
task: fix-supabase-edge-instrumentation
timestamp_utc: 2026-01-30T13:37:33Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Edge-safe Supabase instrumentation

## Requirements

- Functional:
  - Remove Node-only dependencies from `server/supabase-instrumentation.ts` so Edge middleware can call `getMiddlewareSupabaseClient` safely.
  - Preserve N+1 detection behavior in `instrumentedSupabaseFetch` (best-effort).
- Non-functional (a11y, perf, security, privacy, i18n):
  - Edge runtime compatibility (no Node core modules).
  - Keep overhead minimal; avoid blocking fetch for instrumentation.
  - No secrets in logs; signatures remain non-sensitive.

## Existing Patterns & Reuse

- `server/supabase.ts` wires `instrumentedSupabaseFetch` into all Supabase clients including middleware.
- `lib/analytics/emit.ts` uses Web Crypto (`crypto.subtle`) for hashing in browser contexts (Edge-safe reference).

## External Resources

- Web Crypto API (SubtleCrypto) for Edge-safe hashing (platform API; no external dependency).

## Constraints & Risks

- Edge runtime forbids Node core modules (`node:crypto`) in middleware bundle.
- Instrumentation is best-effort; hashing can be approximate but must not throw.

## Open Questions (owner, due)

- Q: Prefer Web Crypto hashing (async) or a synchronous non-crypto hash for signatures? (owner: github:@amanshresthaa, due: 2026-01-30)
  A: Use a synchronous non-crypto hash to avoid async overhead; acceptable because signatures are internal.

## Recommended Direction (with rationale)

- Replace `node:crypto` usage with a small, deterministic, Edge-safe hash (e.g., FNV-1a) over a capped body sample. This keeps the implementation synchronous and avoids Edge bundling issues while preserving N+1 signal fidelity.
