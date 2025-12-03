---
task: auto-assign-hold-permission
timestamp_utc: 2025-12-03T09:31:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Auto-assign hold permission error

## Requirements

- Functional: diagnose and fix booking auto-assign flow failing with `permission denied for table table_holds` and ensure strict conflict enforcement behaves as expected.
- Non-functional (a11y, perf, security, privacy, i18n): N/A for backend fix; ensure logging does not leak sensitive data.

## Existing Patterns & Reuse

- Table hold logic lives in `server/capacity/table-assignment/quote.ts` and `server/capacity/holds.ts`; callers pass an optional Supabase client but default to the service client from `getServiceSupabaseClient()`.
- Tenancy-aware client helper `getTenantServiceSupabaseClient(restaurantId)` exists and is used in some ops routes, but auto-assign flow still relies on the service client.

## External Resources

- Supabase tenant RLS migration (`supabase/supabase/migrations/20251107094000_tenant_rls_foundation.sql`) introduces policies requiring `require_restaurant_context()` for `table_holds` and related tables.
- Function `require_restaurant_context()` reads `app.restaurant_id` or `X-Restaurant-Id` header and raises `42501` when absent.

## Constraints & Risks

- DB permissions are remote Supabase only; changes may require migrations/policies.
- Risk of altering booking/hold logic leading to double bookings or missing conflict enforcement.
- RLS now expects per-request restaurant context; using the service client without tenant context causes `permission denied for table table_holds` in PostgREST (observed in logs and reproduced in code paths).

## Open Questions (owner, due)

- Which role/user is executing the failing query? (owner: assistant, due: 2025-12-03)
- Are there RLS policies or grants missing for `table_holds` in the environment? (owner: assistant, due: 2025-12-03)
- What is the expected behavior for strict conflict enforcement and how is it configured? (owner: assistant, due: 2025-12-03)
- Does `quoteTablesForBooking` or `atomicConfirmAndTransition` need to switch to tenant-scoped clients by default to satisfy new RLS? (owner: assistant, due: 2025-12-03)

## Recommended Direction (with rationale)

- Use tenant-scoped Supabase client (with `X-Restaurant-Id`) for capacity/hold flows when no client is supplied, so RLS policies with `require_restaurant_context()` pass. Implement inside capacity entry points (e.g., `quoteTablesForBooking`, `atomicConfirmAndTransition`) to cover all callers including inline auto-assign.
- Verify strict conflict enforcement GUC after client swap; expectation is RPC `set_hold_conflict_enforcement` + `is_holds_strict_conflicts_enabled` should return true once the session is scoped correctly.
