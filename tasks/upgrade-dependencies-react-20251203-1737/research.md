---
task: upgrade-dependencies-react
timestamp_utc: 2025-12-03T17:37:42Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Research: Update dependencies (React focus)

## Requirements

- Functional: bring React (and ReactDOM) plus supporting stack to latest stable versions without breaking app functionality.
- Non-functional (a11y, perf, security, privacy, i18n): maintain performance budgets, keep a11y intact, patch security vulnerabilities from outdated packages, avoid breaking builds/tests; keep Supabase remote-only rule unchanged.

## Existing Patterns & Reuse

- Uses pnpm workspace with Next.js App Router (`src/app`), Shadcn-based UI components under `src/components/ui`, and Vitest for tests.
- Supabase remote-only rules apply; no DB migrations expected for dependency bumps.
- Patches/overrides already present: `tar`, `prismjs`, `nodemailer`, plus patches for `tr46` and `whatwg-url`.

## External Resources

- React 19.2 release notes highlight new Activity component and useEffectEvent, indicating 19.x is the active stable line. React 19.2.1 is the current npm patch (registry). citeturn0context7_3turn2search4
- Next.js 16 series is current; 16.0.7 includes security fixes (XSS cache poisoning) and requires Node ≥20.9.0 per release docs. citeturn0search0turn0search2
- Storybook 10.x is the latest major (up from 8.6.14), implying migration work. citeturn0search6

## Constraints & Risks

- Next.js/React version compatibility must be preserved.
- Storybook (8 → 10), BullMQ (4 → 5), eslint-plugin-react-hooks (5 → 7), @react-email/render (1 → 2) are major jumps that may require code/config changes.
- pnpm lockfile must remain consistent; overrides/patches may conflict with newer releases and may need adjustment.
- Next 16.0.7 security fixes are desirable but may introduce stricter caching/headers; ensure middleware/config still valid.

## Open Questions (owner, due)

- Are there pinned versions that must remain (e.g., patched deps) — owner: engineering, due: before upgrade.
- Is Storybook upgrade to 10.x required now, or can we defer to reduce risk? — owner: maintainers, due: before implementation.
- Any runtime environments below Node 20.9.0 that would block Next 16.0.7? — owner: ops, due: before build.

## Recommended Direction (with rationale)

- Inventory current versions (done via `pnpm outdated` → 68 packages; saved `artifacts/pnpm-outdated.json`).
- Upgrade React/ReactDOM + @types to latest patch (19.2.1) and bump Next.js + @next/mdx/eslint-config-next to 16.0.7 to stay within supported matrix.
- Prioritize security/patch updates first (Next 16.0.7, axios 1.13.x, nodemailer 7.0.11, supabase-js 2.86.0).
- Stage major upgrades with known migrations:
  - Storybook 8 → 10 using `npx storybook@latest upgrade` guide.
  - BullMQ 4 → 5 breaking changes (queues/api review).
  - eslint-plugin-react-hooks 7 and @typescript-eslint 8.48.x may require rule config tweaks.
  - @react-email/render 2.0.0 migration check for breaking API.
- Use `pnpm up -L` in batches (core runtime, build toolchain, UI libs) to isolate breakage; update patches/overrides only if they become unnecessary.
- Run lint/test/build after each batch; manual QA via DevTools MCP on a key route before sign-off.
