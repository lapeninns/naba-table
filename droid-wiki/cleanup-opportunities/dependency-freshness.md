# Dependency freshness

Review dependency freshness by group rather than blind bulk upgrades. Runtime groups in `package.json` include Next/React, Supabase, Radix/shadcn, TanStack Query, Resend, analytics, routing, form, and date libraries. Test/build groups include Vitest, Playwright, Vite, Storybook, TypeScript, ESLint, Prettier, and QA tooling.

## Upgrade posture

- Prefer small dependency groups with a matching QA command pack.
- Re-check shadcn/Luma guards for UI dependency changes.
- Re-check env validation for runtime integration dependency changes.
- Treat Next/React/Supabase upgrades as broad platform work, not routine freshness cleanup.

Related: [Dependencies](../reference/dependencies.md).
