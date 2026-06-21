# Verification Contract

Verification must match the change type. Do not run irrelevant commands just to look busy, and do not omit required checks when the blast radius demands them.

## Repo validation reality

Use commands that actually exist in this repo:

- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm exec vitest ...`
- `pnpm exec playwright test ...`
- `pnpm exec prettier --check ...`
- `pnpm validate:env`

Coverage reality:

- `pnpm run lint` covers `server`, `lib`, `scripts`, `src/app/app`, and `src/components/features` (plus the `guard:no-shadcn:strict` check).
- It does **not** cover all of `src/**`, `components/**`, or markdown files.
- For changed JS/TS files outside that scope, run targeted eslint such as `pnpm exec eslint --max-warnings=0 <files...>` or explicitly record that no repo lint command covered those files.
- There is no package-level `pnpm test` script and no markdownlint script.

## Route and API verification baseline

- Keep the route/API identity contract in the task folder or handoff.
- Verify against the declared host context, proxy behavior, and auth expectation.
- If the real runtime behavior differs from the declared identity, stop and escalate instead of normalizing the mismatch.

## Browser verification rules

- Real shipped routes come first for UI changes.
- Root-host `/dev/**`, internal app-host `src/app/app/dev/**` reached as root-host `/app/dev/**` transport or app-host `/dev/**` depending on host mode, and `__dev/**` remain harness-only verification.
- Harness passes supplement state coverage; they do not replace shipped-route verification.
- Record host context when it matters: app host vs root host.

## Verification by change type

### Docs or operating-layer markdown

Required:

- `pnpm exec prettier --check ...` on the touched markdown files
- accurate statement that no runtime or browser behavior changed

### UI route or page

Required:

- browser verification on the real shipped route
- route/API identity rows covering the checked route(s)
- responsive check at the breakpoints that matter to the change
- keyboard/focus/accessibility spot check
- loading, empty, error, and success coverage when affected

Supplemental:

- harness verification on root-host `/dev/**`, on internal `src/app/app/dev/**` reached as root-host `/app/dev/**` or app-host `/dev/**` depending on host mode, or on `__dev/**` only when it expands state coverage

### Shared UI primitive

Required:

- identify whether the code lives in `components/ui/**`, `src/components/ui/**`, or another shared export path
- record the consumer scan that proves one-surface vs two-surface impact
- treat `components/ui/**` as high-risk by default
- verify at least one real consumer per affected surface
- add harness coverage only when it materially improves QA

### Server or API change

Required:

- verify the changed boundary directly
- include route/API identity rows for the changed endpoints or handlers
- run `pnpm run lint` and `pnpm run typecheck` when the touched code is covered by those commands
- run targeted eslint or record the lint-coverage gap for changed JS/TS outside `server`, `lib`, `scripts`, `src/app/app`, and `src/components/features`
- add targeted Vitest or Playwright coverage when a regression path exists

### Auth, security, or permission change

Required:

- happy path
- negative path
- tenant or permission boundary check
- explicit note of anything not verified

Treat these as high risk unless the blast radius is obviously smaller.

### Proxy or host-routing change

Required:

- verify both host contexts affected by the change
- verify redirects, rewrites, and protected/unprotected paths relevant to the task
- record exact routes, proxy expectations, and outcomes against the identity contract

Changes here are normally high risk because `src/proxy.ts` controls the surface split.

### Supabase or data-path change

Required:

- record `APP_ENV`, `DB_TARGET_ENV`, and the target class: read-only, write path, or migration/destructive
- run `pnpm validate:env` before remote work when the environment is available, and record the outcome truthfully
- state the remote target used and stage on staging first unless explicitly directed otherwise
- verify the read/write path or migration behavior that changed
- note read-replica reality when relevant, including `FEATURE_SERVICE_CLIENT_USE_READ_REPLICA` and `SUPABASE_READ_REPLICA_URL` expectations from `scripts/validate-env.ts`
- document any safety overrides or unverified gaps explicitly

Do not describe a local Supabase validation flow. That is not a Nabatable workflow.

## Evidence contract

Every medium/high-risk handoff must state:

- exact commands run
- command outcomes
- route/API identity rows checked, or `Not applicable`
- real routes checked
- harness routes checked, clearly labeled
- env safety checks run, if any
- artifacts captured, if any
- remaining caveats or blockers

## Failure rule

If required verification fails or cannot be run, do not claim completion. Report the failure or block exactly.
