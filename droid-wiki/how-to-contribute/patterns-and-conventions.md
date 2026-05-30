# Patterns and conventions

Use shadcn/Radix primitives from `components/ui/**`, keep route handlers thin, use `server/supabase.ts` for Supabase clients, keep Supabase remote-only, and match validators to the change.

## Current conventions

- Route handlers collect request context, auth, and validation, then delegate to domain modules.
- Ops browser code should use `src/services/ops/**`, `src/hooks/ops/**`, and React Query patterns instead of ad hoc fetches.
- React Query SWR UX follows `docs/sdlc/react-query-swr-ux.md`: per-hook `placeholderData`, content-only `StaleBoundary`, and explicit loading states.
- Shared UI spans both `components/**` and `src/components/**`; primitive edits require consumer scans and stricter verification.
- `scripts/check-no-shadcn.mjs` and `scripts/check-luma-compliance.mjs` enforce major UI guardrails.

Related: [Tooling](tooling.md).
