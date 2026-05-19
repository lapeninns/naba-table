# UI Regression QA

Sprint 13 adds a focused local entrypoint for UI-system, accessibility, keyboard, and visual route coverage:

```sh
pnpm run qa:ui-regression
```

The command runs:

- `guard:no-shadcn` to keep the shadcn primitive migration inventory visible.
- `guard:luma:strict` to enforce the Radix Luma baseline ratchet for above-baseline exception findings.
- axe component checks for the booking dialog, reserve plan step, and table assignment panel.
- keyboard/focus checks for table assignment grids, virtualized table rows, booking action menus, non-actionable badges, and stale content inertness.
- Playwright visual route smoke at mobile and desktop breakpoints for public home, public booking, guest sign-in, onboarding entry, and ops sign-in.
- critical axe checks and horizontal-overflow checks inside the Playwright visual route smoke.
- screenshot artifacts under the shared QA browser artifact directory for public, public booking, guest, ops sign-in, and authenticated app-host routes.
- a command-composition QA test so the selector stays intentional.

This suite uses shipped routes for browser proof. Authenticated app-host proof is driven by the local-only QA auth fixture and is separate from unauthenticated sign-in boundary checks.

The Luma semantic-token migration inventory is pinned in `config/qa/luma-baseline.json`. Existing debt remains visible in guard output, but `guard:luma:strict` now fails when exception findings increase for any file/finding-kind group. Refresh the baseline only after reviewing intentional debt movement with `pnpm run guard:luma:update-baseline`.

Tags: `@p2`, `@a11y`, `@visual`, `@browser`, `@smoke`.
