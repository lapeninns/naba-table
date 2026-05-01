## Objective

Move the repo toward 100% shadcn primitive coverage across ops, guest/public, auth/dashboard, and reserve code by executing the provided sequenced primitive-layer plan in this checkout.

## Repo facts

- Root `AGENTS.md` requires shadcn/ui-first work, truthful verification, and task folders for medium/high-risk work.
- `components/ui/**` is the canonical shadcn alias in `components.json`.
- `pnpm exec shadcn info` reports Next.js App Router, RSC enabled, lucide icons, and resolved UI path `components/ui`.
- `pnpm exec shadcn docs ...` is not available in the installed shadcn CLI (`unknown command 'docs'`), so local component source is the API reference for this run.
- Current worktree was dirty before this task: existing deletions include `src/components/guest/ui/GuestPrimitives.tsx`, `components/ui/.backup-20251003/**`, and reserve booking helper files.
- `.github/workflows` is absent in this checkout.
- No `data-tooltip-id` or `data-tooltip-content` consumers remain in app/reserve source, so the old global `react-tooltip` bridge can be removed instead of moved into `components/ui`.

## Assumptions and tradeoffs

- Treat the provided PR list as the execution sequence, but do not create real PRs from this local run.
- Preserve pre-existing user changes and do not restore deleted files unless needed for this objective.
- Color-token cleanup remains out of scope; the guard's color findings stay advisory.
- For native renderable replacements, use existing shadcn primitives and repo-owned guest wrappers without changing business logic.
- Removing unused `react-tooltip` is in scope because it prevents preserving a second tooltip primitive system.

## Constraints

- No secrets or remote data work.
- Supabase is not involved.
- Shared primitive work in `components/ui/**` makes this high-risk under the repo tiering rules.
- UI changes require real shipped-route browser verification where the environment allows it.
- `pnpm run lint` does not cover every changed JS/TS file; targeted eslint is required or the gap must be recorded.

## Risks

- Removing `src/components/ui/**` can break aliases or imports that currently resolve there first.
- Deleting `reserve/shared/ui/**` can break reserve aliases if any consumer remains.
- Whole-repo scan expansion can expose unrelated app code and CI noise.
- Browser verification may be auth- or environment-blocked.

## Reuse notes

- Reuse `components/ui/button`, `components/ui/card`, `components/ui/form`, `components/ui/input`, `components/ui/label`, and `components/ui/table`.
- `components/auth/OpsSignInForm.tsx` is the local pattern for `FormRoot` and shadcn-owned auth form composition.
- Use lucide-react icons directly for reserve `RouteError` rather than keeping the reserve icon barrel.

## Non-goals

- No color-token migration.
- No theme split changes.
- No business logic, data layer, auth contract, or proxy refactor.
- No cleanup of unrelated dirty files.

## Route/API identity

| Host context | External path | Internal file or handler | Expected proxy behavior | Auth expectation |
| ------------ | ------------- | ------------------------ | ----------------------- | ---------------- |
| Root host | `/auth/signin` | `src/app/(public)/auth/signin/page.tsx` -> `components/auth/GuestSignInForm.tsx` | Root-host public route, no app-host redirect expected | Public guest sign-in route |
| Root host | `/restaurants` | `src/app/(public)/restaurants/page.tsx` -> `src/components/restaurants/PublicSections.tsx` | Root-host public route, no app-host redirect expected | Public route |
| Root host | `/restaurants/[slug]` | `src/app/(public)/restaurants/[slug]/page.tsx` -> `src/components/restaurants/PublicSections.tsx` | Root-host public route, no app-host redirect expected | Public route |
| Root host reserve app | Reserve router error boundary | `reserve/pages/RouteError.tsx` | Vite reserve app routing, outside Next proxy | Public reserve client route |
| Root/App host | Next error boundaries | `src/app/error.tsx`, `src/app/global-error.tsx` | Rendered by Next when a segment/root error occurs | Depends on throwing route; boundary itself must stay client-safe |
