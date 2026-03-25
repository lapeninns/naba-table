# Continuity Ledger

Last updated: 2026-03-25T13:22:06Z

## Goal (incl. success criteria)

- Implement feature `remove-deprecated-guest-thank-you-from-sitemap` for milestone `guest-booking-lifecycle`.
- Success means `/guest/thank-you` is omitted from sitemap output while canonical booking and receipt destinations remain listed, and the deprecated alias still redirects correctly when opened directly.

## Constraints/Assumptions

- Work only in the isolated mission worktree and keep scope limited to sitemap/canonical route listing for the deprecated guest thank-you alias.
- Follow the existing guest booking lifecycle canonicalization patterns; do not introduce a competing thank-you surface.
- Required validation includes baseline manifest test command, targeted sitemap/routing checks from the assigned feature, `pnpm typecheck`, `pnpm lint`, and manual inspection of generated sitemap output.

## Key decisions

- Reuse the existing canonical booking/receipt route inventory and remove only the deprecated `/guest/thank-you` alias from sitemap output.
- Keep redirect behavior unchanged; only sitemap generation should stop advertising the deprecated alias.

## State

- Startup context is being refreshed for the guest thank-you sitemap cleanup feature.
- Mission docs, services manifest, library notes, and current sitemap/test files still need targeted review for this feature.

## Done

- Invoked required startup and worker skills.
- Reviewed assigned feature metadata and routing/sitemap expectations for deprecated `/guest/thank-you`.
- Read root `AGENTS.md`, `README.md`, mission proposal, validation contract, feature list, and routing library notes.

## Now

- Initialize the workspace, run baseline validation, and inspect existing sitemap generation plus guest thank-you route coverage.

## Next

- Run baseline validation from the services manifest, add/adjust sitemap tests first, implement sitemap updates, then run required validators and inspect sitemap output.

## Open questions (UNCONFIRMED if needed)

- UNCONFIRMED: where sitemap entries are assembled and whether `/guest/thank-you` is still emitted from a static route list or metadata helper.

## Working set (files/ids/commands)

- `.factory/services.yaml`
- `.factory/library/guest-routes.md`
- `.factory/library/environment.md`
- `.factory/library/user-testing.md`
- `tests/guest/public-booking-redirects.test.ts`
- `tests/e2e/guest-receipt-pages.spec.ts`
- sitemap-related files under `src/app/**`, `lib/**`, `next-sitemap.config.js`
