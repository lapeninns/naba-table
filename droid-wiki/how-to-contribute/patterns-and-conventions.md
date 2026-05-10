# Patterns and conventions

Use shadcn/Radix primitives from `components/ui/**`, keep route handlers thin, use `server/supabase.ts` for clients, keep Supabase remote-only, and match validators to the change. `scripts/check-no-shadcn.mjs` and `scripts/check-luma-compliance.mjs` enforce major UI guardrails.

Related: [Tooling](tooling.md).
