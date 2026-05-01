## Scope verified

- Task folder created for high-risk shared primitive work.
- `pnpm exec shadcn info` succeeded and confirmed `components/ui` as the resolved UI path.
- `pnpm exec shadcn docs button card form input label table` failed because this installed shadcn CLI has no `docs` command.
- Current worktree had pre-existing dirty deletions before implementation. Notably, `src/components/guest/ui/GuestPrimitives.tsx`, `components/ui/.backup-20251003/**`, some reserve helper files, `test-results/.last-run.json`, and `.cursor/plans/shadcn_primitive_layer_8a119d6a.plan.md` were already dirty/untracked.
- `rg` confirmed there are no `data-tooltip-id` or `data-tooltip-content` app/reserve consumers, so the previous `react-tooltip` global bridge was removed rather than preserved as a parallel tooltip system.

## Route/API identity rows exercised

- Root host `/auth/signin` -> `components/auth/GuestSignInForm.tsx`: exercised with HTTP 200 and screenshot.
- Root host `/restaurants` -> `src/components/restaurants/PublicSections.tsx`: exercised with HTTP 200 and screenshot.
- Root host `/restaurants/the-old-crown-girton` -> `src/components/restaurants/PublicSections.tsx`: exercised with screenshot.
- Root host `/contact` and `/privacy`: exercised because expanded primitives-only guard caught standalone anchors in those pages.
- App host `/settings/restaurant/team`: exercised with HTTP 307 redirect to `/auth/signin?redirectedFrom=%2Fsettings%2Frestaurant%2Fteam`, confirming app-host auth gate still applies.
- Reserve app route boundary: not browser-exercised; `pnpm run reserve:build` compiled reserve code successfully.

## Commands run

| Command | Outcome |
| ------- | ------- |
| `date +%Y%m%d-%H%M` | Passed; task suffix `20260501-1726`. |
| `git status --short` | Passed; showed pre-existing dirty deletions and `.cursor/plans/shadcn_primitive_layer_8a119d6a.plan.md`. |
| `pnpm exec shadcn info` | Passed; Next.js App Router, RSC enabled, UI path `components/ui`. |
| `pnpm exec shadcn docs button card form input label table` | Failed; installed CLI returned `unknown command 'docs'`. |
| `pnpm node scripts/check-no-shadcn.mjs` | Passed; 0 blocking findings, 54 ad-hoc color advisories. |
| `pnpm node scripts/check-no-shadcn.mjs --strict` | Passed; 0 non-color blocking/strict findings, 54 ad-hoc color advisories. |
| `pnpm node scripts/check-no-shadcn.mjs --primitives-only --baseline=tasks/shadcn-primitive-100-20260501-1726/baseline.json` | Passed; baseline written with `{ blocking: {}, advisory: { "ad-hoc-token": 54 } }`. Latest run scanned 488 files after removing the unused global tooltip wrapper. |
| `pnpm node scripts/check-no-shadcn.mjs --primitives-only` with temporary `src/components/__primitive-gate-fixture.tsx` containing native `<button>` | Failed as expected with 1 `native-renderable` blocking finding; fixture was deleted afterward. |
| `pnpm run lint` | Passed with 11 pre-existing warnings in unrelated `lib/**` and `server/**` files; guard strict passed. |
| `pnpm run typecheck` | Passed. |
| `pnpm exec eslint --max-warnings=0 --no-warn-ignored ...changed JS/TS files...` | Passed. |
| `pnpm exec prettier --check ...changed files excluding pnpm-lock.yaml...` | Passed. |
| `pnpm exec prettier --check pnpm-lock.yaml` | Failed; the existing pnpm lockfile style is not Prettier-compatible. The lockfile diff was kept to the pnpm dependency-removal lines only. |
| `pnpm run reserve:build` | Passed; Vite built reserve successfully. Generated `dist/reserve` output was restored/removed because it is not part of this source diff. |
| `pnpm remove react-tooltip` | Passed; removed the unused parallel tooltip dependency. |
| `pnpm install --lockfile-only --frozen-lockfile` | Passed; confirmed `package.json` and `pnpm-lock.yaml` remain consistent after removal. |
| `curl -I --max-time 20 http://localhost:3000/auth/signin` | Passed; HTTP 200. |
| `curl -I --max-time 20 http://localhost:3000/restaurants` | Passed; HTTP 200. |
| `curl -I --max-time 20 http://localhost:3000/contact` | Passed; HTTP 200. |
| `curl -I --max-time 20 http://localhost:3000/privacy` | Passed; HTTP 200. |
| `curl -I --max-time 20 http://app.localhost:3000/settings/restaurant/team` | Passed; HTTP 307 to `/auth/signin?redirectedFrom=%2Fsettings%2Frestaurant%2Fteam`. |
| `pnpm exec playwright screenshot --full-page ...` for `/auth/signin`, `/restaurants`, `/restaurants/the-old-crown-girton`, `/contact`, `/privacy` | Passed; screenshots captured in `artifacts/`. |

## Real routes or APIs checked

- `http://localhost:3000/auth/signin`
- `http://localhost:3000/restaurants`
- `http://localhost:3000/restaurants/the-old-crown-girton`
- `http://localhost:3000/contact`
- `http://localhost:3000/privacy`
- `http://app.localhost:3000/settings/restaurant/team` redirect/auth gate

## Harness routes checked

None. Real shipped routes were used for browser screenshots where feasible.

## Env safety checks

- `pnpm dev` ran `validate:env` and reported `schema=development`, `NODE_ENV=development`, `APP_ENV=staging`, `VERCEL_ENV=unset`.
- No Supabase or remote data work in scope.

## Artifacts captured

- `tasks/shadcn-primitive-100-20260501-1726/artifacts/auth-signin.png`
- `tasks/shadcn-primitive-100-20260501-1726/artifacts/restaurants.png`
- `tasks/shadcn-primitive-100-20260501-1726/artifacts/restaurant-detail.png`
- `tasks/shadcn-primitive-100-20260501-1726/artifacts/contact.png`
- `tasks/shadcn-primitive-100-20260501-1726/artifacts/privacy.png`

## Not run

- Forced Next error-boundary browser state. The root error files compile and typecheck, but no shipped route was intentionally broken to display those boundaries.
- Reserve error-boundary browser state. Reserve compiled with `pnpm run reserve:build`, but no Vite browser route was driven into `ReserveErrorBoundary`.

## Remaining caveats or blockers

- `.github/workflows` was absent at the start of this run, so this change adds a new `shadcn-primitives.yml` workflow rather than editing an existing CI workflow.
- `pnpm run lint` still prints unrelated pre-existing warnings in `lib/owner/team/schema.ts`, `lib/profile/server.ts`, and several `server/**` files.
- The dev server is running on `http://localhost:3000` after restarting a stale pre-existing server that still referenced the deleted `src/components/ui/calendar.tsx`.

## Follow-up verification

Rechecked on 2026-05-01 after inspecting the existing dirty worktree:

| Command | Outcome |
| ------- | ------- |
| `pnpm node scripts/check-no-shadcn.mjs` | Passed; 0 blocking findings, 54 ad-hoc color advisories. |
| `pnpm node scripts/check-no-shadcn.mjs --strict` | Passed; 0 non-color blocking/strict findings, 54 ad-hoc color advisories. |
| `pnpm node scripts/check-no-shadcn.mjs --primitives-only --baseline=tasks/shadcn-primitive-100-20260501-1726/baseline.json` | Passed; scanned 488 files after removing the last `react-tooltip` wrapper, and baseline still shows `{ blocking: {}, advisory: { "ad-hoc-token": 54 } }`. |
| `pnpm run typecheck` | Passed. |
| `pnpm run lint` | Passed with the same 11 unrelated warnings already noted above. |
| `pnpm exec eslint --max-warnings=0 --no-warn-ignored ...changed JS/TS files...` | Passed. |
| `pnpm exec prettier --check ...changed files and task docs...` | Passed. |
| `pnpm install --lockfile-only --frozen-lockfile` | Passed after removing the unused `react-tooltip` package dependency. |
| `pnpm run reserve:build` | Passed; generated `dist/reserve` assets were restored/removed afterward so build output is not part of this source diff. |
| `git diff --check` | Passed. |
| Grep/import checks for `src/components/ui`, `reserve/shared/ui`, `GuestPrimitives`, and moved calendar/copy-button imports | Passed; remaining `src/components/ui` mentions are only SDLC docs describing historical shared-primitive risk. |
| `curl -I --max-time 20 http://localhost:3000/auth/signin` | Passed; HTTP 200. |
| `curl -I --max-time 20 http://localhost:3000/restaurants` | Passed; HTTP 200. |
| `curl -I --max-time 20 http://localhost:3000/restaurants/the-old-crown-girton` | Passed; HTTP 200. |
| `curl -I --max-time 20 http://app.localhost:3000/settings/restaurant/team` | Passed; HTTP 307 to `/auth/signin?redirectedFrom=%2Fsettings%2Frestaurant%2Fteam`. |
