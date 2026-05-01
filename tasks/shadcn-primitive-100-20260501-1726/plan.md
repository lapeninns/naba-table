## Plan pointer

This task folder records the runtime evidence for `.cursor/plans/shadcn_primitive_layer_8a119d6a.plan.md`, specifically the harness-bootstrap closure and primitives-only gate proof.

## Risk tier

High. The work touches the canonical shared primitive root `components/ui/**`, removes alternate primitive systems, changes app-host/root-host reachable UI, changes reserve UI, and modifies the repo-wide guard/CI contract.

## Affected surfaces and files

- Shared primitives: `components/ui/calendar.tsx`, `components/ui/copy-button.tsx`, `src/components/ui/**`, `tsconfig.json`
- Dependency cleanup: remove unused `react-tooltip` after confirming no `data-tooltip-*` consumers remain
- Guard/CI/docs: `scripts/check-no-shadcn.mjs`, `AGENTS.md`, GitHub Actions workflow if one exists or must be added
- Guest/auth: `components/auth/GuestSignInForm.tsx`, `src/app/error.tsx`, `src/app/global-error.tsx`
- Public guest: `src/components/restaurants/PublicSections.tsx`
- Reserve: `reserve/pages/RouteError.tsx`, `reserve/shared/ui/**`
- Task evidence: this task folder

## Route/API identity

See `research.md`. No API or Supabase boundary is changed.

## Shared-ownership decision

`components/ui/**` is the single canonical shadcn root. Existing `src/components/ui/**` files should be moved into that root and imports updated so the alternate root can be removed. `reserve/shared/ui/**` and `src/components/guest/ui/GuestPrimitives.tsx` are treated as parallel UI systems and removed only after consumer scans.

## Success criteria

- Only `components/ui/**` remains as the allowed shadcn primitive root.
- `src/components/ui/**`, `reserve/shared/ui/**`, and `src/components/guest/ui/GuestPrimitives.tsx` have no app consumers and are removed.
- `pnpm node scripts/check-no-shadcn.mjs --primitives-only` supports baseline output and passes with zero blocking findings.
- Native renderables listed in the provided scope are replaced with shadcn primitives or approved `asChild` composition.
- CI runs the primitives-only guard on PRs where workflow support exists in this checkout.
- Verification commands and route/browser checks are recorded truthfully.

## Implementation sequence

1. Bootstrap task artifacts and record current repo facts.
2. Collapse `src/components/ui/{calendar,copy-button}.tsx` into `components/ui/**`, update aliases/imports, and remove the stale calendar backup file.
3. Add `--primitives-only` and `--baseline=<path>` to `scripts/check-no-shadcn.mjs`.
4. Replace the `reserve/pages/RouteError.tsx` icon import with direct lucide usage.
5. Delete the unused parallel UI systems after grep confirmation.
6. Replace the scoped native renderables with shadcn primitives or `Button asChild`.
7. Remove the unused global `react-tooltip` bridge instead of moving it into the shadcn primitive root.
8. Expand scan roots/repo-wide bans, refresh baseline, and add CI/doc gate.
9. Run validators, browser checks if possible, and self-review.

## Verification plan

- `pnpm node scripts/check-no-shadcn.mjs`
- `pnpm node scripts/check-no-shadcn.mjs --strict`
- `pnpm node scripts/check-no-shadcn.mjs --primitives-only --baseline=tasks/shadcn-primitive-100-20260501-1726/baseline.json`
- `pnpm run lint`
- `pnpm run typecheck`
- targeted eslint for changed JS/TS files outside `pnpm run lint` coverage
- grep checks for removed imports/directories
- real-route browser checks for `/auth/signin`, `/restaurants`, `/restaurants/[slug]`, and feasible error/reserve boundaries; record blockers instead of implying proof.

## Stop rules

- Stop and re-plan if consumer scans show cross-surface behavior that requires more than primitive migration.
- Stop if deleting a parallel UI directory leaves unresolved imports that require redesign rather than replacement.
- Stop if browser or CI workflow verification needs credentials or infrastructure not available in this environment.
