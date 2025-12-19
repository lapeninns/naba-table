# Verification

## Automated Tests

- Not run yet (local Playwright headless blocked on this host). Recommend running `pnpm exec playwright test tests/e2e/guest/guest-routes.spec.ts` and `pnpm exec playwright test tests/e2e/guest/guest-redirects.spec.ts` via CI workflow.

## Notes

- Local Playwright runs may be blocked by headless shell constraints; if so, use CI workflow and attach report artifacts.
