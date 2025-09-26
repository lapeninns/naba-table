# Contributing to SajiloReserveX

## Prerequisites

- Node 20+, pnpm 9+
- Copy `.env.example` to `.env.local`; never commit secrets.
- Install dependencies with `pnpm install` (installs Husky hook automatically).

## Branch & PR Workflow

1. Branch naming `feat/reserve-*`, `fix/reserve-*`, or `chore/reserve-*`.
2. Keep PRs under 500 LOC when possible and include context + screenshots for UI changes.
3. Link to Jira/Linear tickets in the PR description.
4. Run the Definition of Done checklist before requesting review:
   - [ ] `pnpm typecheck`
   - [ ] `pnpm lint`
   - [ ] `pnpm test`
   - [ ] `pnpm build`
   - [ ] `pnpm analyze`
   - [ ] Manual keyboard + screen reader smoke test of affected flows

## Coding Standards

- Prefer composing hooks + headless UI pieces from `reserve/shared`.
- MUST meet a11y baselines: visible focus, keyboard support (per WAI-ARIA APG), aria-live for status messages.
- Use Suspense/Error Boundaries for each route chunk.
- All new APIs go through `@shared/api/client` with Zod validation + normalized errors.
- Avoid cross-feature imports; use feature entry points or shared utilities only.

## Testing Guidance

- Unit tests live beside the feature (`*.test.ts(x)`).
- Integration tests under `reserve/tests/integration` using React Testing Library + MSW.
- E2E tests belong in `reserve/tests/e2e` and run with Playwright.
- Prefer behaviour assertions over snapshots; keep tests deterministic.

## Commit & Hooks

- Conventional commits (`feat:`, `fix:`, etc.).
- Husky runs lint-staged (eslint + prettier) on staged files. Use `HUSKY=0` only for emergency hotfixes.

## Support

- For architecture questions, ping #reserve-frontend.
- Create ADRs in `docs/adr/` for significant decisions (start with `ADR-0001`).
