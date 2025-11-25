---
task: fix-occasion-route-params
timestamp_utc: 2025-11-25T22:02:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix Next route params typing regression

## Requirements

- Functional: Restore `pnpm run build` by aligning `/api/ops/occasions/[key]` route handler types with Next.js 16 validation.
- Non-functional: Maintain existing PATCH/DELETE behaviour; no API contract changes; keep auth and auditing intact.

## Existing Patterns & Reuse

- Other dynamic route handlers already use `context: { params: Promise<...> }` and `const { slug } = await params` (e.g., `src/app/api/restaurants/[slug]/calendar-mask/route.ts`).

## External Resources

- Next.js 16 route handler context typing expects `params` to be a `Promise` in generated validator types.

## Constraints & Risks

- Type-only change; risk of forgetting to await params leading to undefined key.
- Must avoid changing runtime behaviour beyond param extraction.
- Supabase generated types lag actual schema (missing `is_builtin`, `deleted_at`, audit table), so selective casting/overrides are necessary to keep type checks passing.

## Open Questions (owner, due)

- None identified.

## Recommended Direction (with rationale)

- Update PATCH/DELETE signatures to accept `params: Promise<{ key: string }>` and destructure via `const { key } = await params;` to satisfy validator and match repo conventions.
