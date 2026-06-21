# PR Baseline QA

Sprint 1 adds a single local entry point for the minimum PR gate:

```sh
pnpm run qa:pr-baseline
```

The command always selects:

- `pnpm run build`
- `pnpm run reserve:build`
- `pnpm run lint`
- `pnpm run typecheck`

It also inspects changed files and adds targeted checks:

- docs/config/QA infrastructure changes: targeted `prettier --check`
- UI changes: shadcn strict guard and Luma strict guard with the pinned semantic-token baseline ratchet
- guest/public shipped UI changes: basic guest/public Playwright smoke specs
- ops UI changes: app-host auth-boundary proof, authenticated shipped-route screenshots, and ops harness smoke specs
- API/server/security changes: basic Vitest API/security smoke specs

To inspect the selected checks without running them:

```sh
pnpm run qa:pr-baseline -- --list
```

To test selector behavior for specific files:

```sh
pnpm run qa:pr-baseline -- --list --changed-file 'src/app/api/bookings/route.ts'
pnpm run qa:pr-baseline -- --list --changed-files 'docs/qa/pr-baseline.md,src/app/(public)/bookings/page.tsx'
```

The Luma strict guard uses `config/qa/luma-baseline.json` to allow existing semantic-token debt while failing on above-baseline exception drift. Refresh that baseline only after reviewing intentional debt movement with `pnpm run guard:luma:update-baseline`.

The runner classifies failures as `product`, `missing-setup`, `baseline-debt`, or `coverage-gap` so local environment problems and known guard debt are visible separately from product regressions.
